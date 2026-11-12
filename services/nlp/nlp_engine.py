from __future__ import annotations

import logging
import math
import os
import re
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

import nltk
from nltk.classify import NaiveBayesClassifier
from nltk.metrics.distance import edit_distance
from nltk.stem import SnowballStemmer, WordNetLemmatizer
from nltk.tokenize import RegexpTokenizer

from knowledge import (
    CUES,
    FILLER_WORDS,
    HUMAN_HANDOFF,
    INTENTS,
    KEEP_WORDS,
    PATH_PREFIXES,
    PRICING_ANSWER,
    SMALL_TALK,
    SYNONYMS,
    TARGET_BY_KEY,
    TARGETS,
    Target,
)

log = logging.getLogger("nlp")

NLTK_DIR = Path(os.environ.get("NLTK_DATA_DIR") or Path(__file__).with_name("nltk_data"))
NLTK_PACKAGES = {
    "stopwords": "corpora/stopwords",
    "wordnet": "corpora/wordnet",
    "omw-1.4": "corpora/omw-1.4",
    "averaged_perceptron_tagger_eng": "taggers/averaged_perceptron_tagger_eng",
}

FAQ_DIRECT = 0.42  # FAQ similarity to answer straight from the FAQ
FAQ_AFFINITY = 0.12  # FAQ similarity to answer from an FAQ whose question shares the intent
FAQ_CONTEXT = 0.15  # FAQ similarity to include the entry as LLM context
CONF_SURE = 0.60  # intent confidence that is enough on its own
CONF_MIN = 0.40  # lower confidence that is enough with a clear margin...
MARGIN_MIN = 0.15  # ...over the second most likely intent
PART_CONTEXT = 0.22  # part similarity to list a part as LLM context
CUE_BOOST = 0.25  # added to an intent when one of its cue words is present

FALLBACK_STOPWORDS = frozenset(
    """a about above after again against am an and any are as at be because been before
    being below between both but by could did do does doing during each few for from
    further had has have having he her here hers herself him himself his i if into is it
    its itself just me might must my myself nor of once only or other our ours ourselves
    own please same shall she should so some such than that the their theirs them
    themselves then there these they this those through to too under until very was we
    were while whom will with would you your yours yourself yourselves""".split()
)

def ensure_nltk_data(download: bool = True) -> dict[str, bool]:
    """Make the NLTK data packages findable, downloading missing ones once."""
    NLTK_DIR.mkdir(parents=True, exist_ok=True)
    if str(NLTK_DIR) not in nltk.data.path:
        nltk.data.path.insert(0, str(NLTK_DIR))

    status: dict[str, bool] = {}
    for package, resource in NLTK_PACKAGES.items():
        try:
            nltk.data.find(resource)
            status[package] = True
            continue
        except LookupError:
            status[package] = False
        if download:
            try:
                status[package] = bool(nltk.download(package, download_dir=str(NLTK_DIR), quiet=True))
            except Exception as exc:
                log.warning("Could not download NLTK package %s: %s", package, exc)
    return status

_REPLACEMENTS: tuple[tuple[re.Pattern[str], str], ...] = tuple(
    (re.compile(p), r)
    for p, r in (
        (r"[‘’‛`]", "'"),
        (r"[“”]", '"'),
        (r"\bcan'?t\b", "can not"),
        (r"\bwon'?t\b", "will not"),
        (r"n't\b", " not"),
        (r"'m\b", " am"),
        (r"'re\b", " are"),
        (r"'ve\b", " have"),
        (r"'ll\b", " will"),
        (r"'d\b", " would"),
        (r"'s\b", ""),
        (r"\be-?mails?\b", "email"),
        (r"\blog-?in\b", "login"),
        (r"\blog-?out\b", "logout"),
        (r"\blog(?:ged)? me out\b", "logout"),
        (r"\bsign(?:ed)?-?out\b", "sign out"),
        (r"\bsign(?:ed)?-?in\b", "sign in"),
        (r"\bpass-?words?\b", "password"),
        (r"\bfaqs\b", "faq"),
        (r"\bpls\b|\bplz\b", "please"),
        (r"\bur\b", "your"),
        (r"\bu\b", "you"),
        (r"\bqty\b", "quantity"),
        (r"\bpo\b", "purchase order"),
        (r"\bt&c'?s?\b", "terms and conditions"),
        (r"\bre-?order", "reorder"),
        (r"\bcatalog\b", "catalogue"),
        (r"\bcolor", "colour"),
    )
)

_TOKENIZER = RegexpTokenizer(r"[a-z0-9]+(?:[./][a-z0-9]+)*")
_PART_TOKEN = re.compile(r"\b[a-z0-9][a-z0-9-]{4,}[a-z0-9]\b", re.IGNORECASE)
_BOILER_CODE = re.compile(r"\bbm[\s-]?(\d{1,4})\b(?!-[a-z])", re.IGNORECASE)
_REFERENCE = re.compile(r"\b[a-z]{2,6}-\d{4}-\d{2,6}\b", re.IGNORECASE)

_POS_MAP = {"J": "a", "V": "v", "N": "n", "R": "r"}
_QUESTION_WORDS = ("why", "how", "where", "what", "when", "which", "who")

_CUE_PATTERNS = {
    label: re.compile(r"(?<![a-z0-9])(?:" + "|".join(re.escape(c) for c in cues) + r")(?:e?s)?(?![a-z0-9])")
    for label, cues in CUES.items()
}


def normalise(text: str) -> str:
    text = unicodedata.normalize("NFKC", text or "").lower()
    for pattern, repl in _REPLACEMENTS:
        text = pattern.sub(repl, text)
    return re.sub(r"\s+", " ", text).strip()


@dataclass
class Processed:
    raw: str
    normalised: str
    tokens: list[str]
    lemmas: list[str]
    content: list[str]
    corrections: dict[str, str] = field(default_factory=dict)

class TextProcessor:
    def __init__(self, resources: dict[str, bool]):
        self.has_wordnet = resources.get("wordnet", False)
        self.has_tagger = resources.get("averaged_perceptron_tagger_eng", False)
        self.stemmer = SnowballStemmer("english")
        self.lemmatizer = WordNetLemmatizer() if self.has_wordnet else None
        try:
            from nltk.corpus import stopwords

            base = set(stopwords.words("english")) if resources.get("stopwords") else set(FALLBACK_STOPWORDS)
        except LookupError:
            base = set(FALLBACK_STOPWORDS)
        self.stopwords = frozenset((base | FILLER_WORDS) - KEEP_WORDS)
        self.vocab: Counter[str] = Counter()
        self._known_cache: dict[str, bool] = {}

    def set_vocabulary(self, texts: Iterable[str]) -> None:
        vocab: Counter[str] = Counter()
        for text in texts:
            vocab.update(t for t in _TOKENIZER.tokenize(normalise(text)) if t.isalpha())
        self.vocab = vocab

    def _is_english_word(self, token: str) -> bool:
        if token in self._known_cache:
            return self._known_cache[token]
        known = False
        if self.has_wordnet:
            from nltk.corpus import wordnet as wn

            known = bool(wn.synsets(token)) or bool(self.lemmatizer and wn.synsets(self.lemmatizer.lemmatize(token)))
        self._known_cache[token] = known
        return known

    def correct(self, token: str) -> str:
        if (
            len(token) < 4
            or not token.isalpha()
            or token in self.vocab
            or token in self.stopwords
            or token in KEEP_WORDS
            or self._is_english_word(token)
        ):
            return token
        max_d = 1 if len(token) <= 5 else 2
        best: tuple[int, int, str] | None = None
        for word, freq in self.vocab.items():
            if abs(len(word) - len(token)) > max_d or len(word) < 3:
                continue
            d = edit_distance(token, word, transpositions=True)
            if d > max_d or (d > 1 and word[0] != token[0]):
                continue
            key = (d, -freq, word)
            if best is None or key < best:
                best = key
        return best[2] if best else token

    def lemmatise(self, tokens: list[str]) -> list[str]:
        if not self.lemmatizer:
            return [self.stemmer.stem(t) for t in tokens]
        if self.has_tagger and tokens:
            try:
                tags = nltk.pos_tag(tokens)
            except LookupError:
                tags = [(t, "") for t in tokens]
        else:
            tags = [(t, "") for t in tokens]
        out = []
        for tok, tag in tags:
            if not tok.isalpha():
                out.append(tok)
                continue
            pos = _POS_MAP.get(tag[:1]) if tag else None
            if pos:
                lemma = self.lemmatizer.lemmatize(tok, pos)
                if lemma == tok and pos != "n":
                    lemma = self.lemmatizer.lemmatize(tok, "n")
            else:
                lemma = self.lemmatizer.lemmatize(self.lemmatizer.lemmatize(tok, "v"), "n")
            out.append(lemma)
        return out

    def process(self, text: str, correct: bool = True) -> Processed:
        norm = normalise(text)
        raw_tokens = _TOKENIZER.tokenize(norm)
        corrections: dict[str, str] = {}
        tokens: list[str] = []
        for tok in raw_tokens:
            fixed = self.correct(tok) if correct else tok
            if fixed != tok:
                corrections[tok] = fixed
            tokens.append(fixed)
        lemmas = self.lemmatise(tokens)
        content = [
            lem for tok, lem in zip(tokens, lemmas) if tok not in self.stopwords and lem not in self.stopwords
        ]
        return Processed(text, norm, tokens, lemmas, content, corrections)

def features(content: list[str]) -> Counter[str]:
    """Unigram + bigram features from content lemmas.

    Bigrams skip question words so generic openers ("where can", "how do") do not
    pull every "where can I ..." question towards the same page.
    """
    feats: Counter[str] = Counter(content)
    terms = [w for w in content if w not in KEEP_WORDS]
    feats.update(f"{a}_{b}" for a, b in nltk.bigrams(terms))
    return feats

class TfidfIndex:
    """Small TF-IDF index with cosine similarity (sublinear tf, smoothed idf)."""

    def __init__(self, docs: list[Counter[str]]):
        self.n = len(docs)
        df: Counter[str] = Counter()
        for d in docs:
            df.update(d.keys())
        self.idf = {t: math.log((1 + self.n) / (1 + c)) + 1.0 for t, c in df.items()}
        self.vectors = [self._weigh(d) for d in docs]

    def _weigh(self, counts: Counter[str] | dict[str, float]) -> dict[str, float]:
        vec = {t: (1.0 + math.log(c)) * self.idf[t] for t, c in counts.items() if c > 0 and t in self.idf}
        norm = math.sqrt(sum(w * w for w in vec.values())) or 1.0
        return {t: w / norm for t, w in vec.items()}

    def vocabulary(self) -> set[str]:
        return set(self.idf)

    def scores(self, query: dict[str, float]) -> list[float]:
        unseen_idf = math.log(1 + self.n) + 1.0
        weighted = {t: w * self.idf.get(t, unseen_idf) for t, w in query.items() if w > 0}
        norm = math.sqrt(sum(w * w for w in weighted.values())) or 1.0
        known = {t: w / norm for t, w in weighted.items() if t in self.idf}
        return [sum(w * vec.get(t, 0.0) for t, w in known.items()) for vec in self.vectors]

    def best_scores(self, queries: list[dict[str, float]]) -> list[float]:
        """Element-wise max over several query variants (plain and synonym-expanded)."""
        result = [0.0] * self.n
        for q in queries:
            result = [max(a, b) for a, b in zip(result, self.scores(q))]
        return result

@dataclass
class Faq:
    id: str
    question: str
    answer: str

@dataclass
class Part:
    key: str
    ids: list[str]
    part_number: str
    name: str
    description: str
    component: str
    boiler_ids: set[str]

@dataclass
class UserContext:
    role: str = "customer"
    allowed: set[str] = field(default_factory=set)
    boilers: list[dict] = field(default_factory=list)  # [{id, code, name}]
    path: str = ""


class Engine:
    def __init__(self, faqs: list[dict] | None = None, parts: list[dict] | None = None, resources: dict[str, bool] | None = None):
        self.resources = resources if resources is not None else ensure_nltk_data(download=False)
        self.text = TextProcessor(self.resources)
        self.faqs = [Faq(str(f["id"]), f["question"], f["answer"]) for f in (faqs or []) if f.get("question")]
        self.parts = self._group_parts(parts or [])
        self.part_numbers: dict[str, list[Part]] = defaultdict(list)
        for p in self.parts:
            if self._real_number(p.part_number):
                self.part_numbers[p.part_number.upper()].append(p)

        self.text.set_vocabulary(self._corpus())
        self._build_intents()
        self._build_faq_index()
        self._build_part_index()
        self._lex_vocab = self.faq_q.vocabulary() | self.faq_a.vocabulary() | self.phrase_index.vocabulary() | self.part_index.vocabulary()
        self.faq_qtype = {f.id: self._question_type(normalise(f.question).split()) for f in self.faqs}
        self.faq_intent = {}
        for f in self.faqs:
            votes: dict[str, float] = defaultdict(float)
            for text, weight in ((f.question, 0.6), (f"{f.question} {f.answer}", 0.4)):
                proc = self.text.process(text, correct=False)
                for label, score in self.classify(proc, self.expand(proc.content)):
                    votes[label] += weight * score
            self.faq_intent[f.id] = max(votes, key=votes.get) if votes else ""

    @staticmethod
    def _real_number(num: str | None) -> bool:
        return bool(num) and num.strip() not in {"-", ""} and any(ch.isdigit() for ch in num)

    def _group_parts(self, rows: list[dict]) -> list[Part]:
        grouped: dict[str, Part] = {}
        for r in rows:
            num = (r.get("part_number") or "").strip()
            name = (r.get("name") or "").strip()
            if not name:
                continue
            key = f"{num.upper()}|{name.lower()}" if self._real_number(num) else f"name:{name.lower()}"
            p = grouped.get(key)
            if not p:
                p = Part(
                    key=key,
                    ids=[],
                    part_number=num if self._real_number(num) else "",
                    name=name,
                    description=(r.get("description") or "").strip().strip("-").strip(),
                    component=(r.get("component_name") or "").strip(),
                    boiler_ids=set(),
                )
                grouped[key] = p
            p.ids.append(str(r.get("id")))
            if r.get("boiler_id"):
                p.boiler_ids.add(str(r["boiler_id"]))
        return list(grouped.values())

    def _corpus(self) -> Iterable[str]:
        for t in TARGETS:
            yield t.label
            yield t.summary
            yield t.how
            yield from t.phrases
            for s in t.subs:
                yield s.label
                yield from s.cues
        for i in INTENTS:
            yield from i.phrases
        for f in self.faqs:
            yield f.question
            yield f.answer
        for p in self.parts:
            yield p.name
            yield p.description
            yield p.component

    def _content(self, text: str) -> list[str]:
        return self.text.process(text, correct=False).content

    @staticmethod
    def _terms(content: list[str]) -> list[str]:
        """Content lemmas for retrieval: question words help intents but add noise to search."""
        return [w for w in content if w not in KEEP_WORDS]

    def _build_intents(self) -> None:
        labelled: list[tuple[str, str]] = [(p, i.key) for i in INTENTS for p in i.phrases]
        labelled += [(p, f"nav:{t.key}") for t in TARGETS for p in t.phrases]
        self.intent_labels = sorted({label for _, label in labelled})

        train = [(self._nb_features(self._content(p)), label) for p, label in labelled]
        self.classifier = NaiveBayesClassifier.train(train)

        self.phrase_labels = [label for _, label in labelled]
        self.phrase_index = TfidfIndex([features(self._content(p)) for p, _ in labelled])

        self.target_index = TfidfIndex(
            [features(self._terms(self._content(" ".join([t.label, t.label, t.summary, t.how])))) for t in TARGETS]
        )

    @staticmethod
    def _nb_features(content: list[str]) -> dict[str, bool]:
        feats = {f"w:{w}": True for w in content}
        terms = [w for w in content if w not in KEEP_WORDS]
        feats.update({f"b:{a}_{b}": True for a, b in nltk.bigrams(terms)})
        return feats

    def _build_faq_index(self) -> None:
        self.faq_q = TfidfIndex([features(self._terms(self._content(f.question))) for f in self.faqs])
        self.faq_a = TfidfIndex([features(self._terms(self._content(f.answer))) for f in self.faqs])

    def _build_part_index(self) -> None:
        docs = []
        for p in self.parts:
            name = self._terms(self._content(p.name))
            desc = self._terms(self._content(p.description))
            comp = self._terms(self._content(p.component))
            c = features(name) + features(name) + features(name) + features(desc) + features(comp)
            if p.part_number:
                c[p.part_number.lower()] += 3
            docs.append(c)
        self.part_index = TfidfIndex(docs)

    def expand(self, content: list[str]) -> list[dict[str, float]]:
        """Return [plain query, synonym-expanded query].

        Scoring takes the better of the two, so synonyms can rescue a paraphrase
        without diluting a query that already matches word for word.
        """
        plain: dict[str, float] = {k: float(v) for k, v in features(content).items()}
        expanded: dict[str, float] = dict(plain)
        for lemma in content:
            for syn in SYNONYMS.get(lemma, ()):
                expanded[syn] = max(expanded.get(syn, 0.0), 0.7)
            if self.text.has_wordnet and lemma.isalpha() and len(lemma) > 3:
                for syn in self._wordnet_synonyms(lemma):
                    if syn in self._lex_vocab_safe():
                        expanded[syn] = max(expanded.get(syn, 0.0), 0.4)
        return [plain, expanded] if expanded != plain else [plain]

    def _lex_vocab_safe(self) -> set[str]:
        return getattr(self, "_lex_vocab", set())

    _wn_cache: dict[str, tuple[str, ...]] = {}

    def _wordnet_synonyms(self, lemma: str) -> tuple[str, ...]:
        if lemma in self._wn_cache:
            return self._wn_cache[lemma]
        from nltk.corpus import wordnet as wn

        names: set[str] = set()
        for syn in wn.synsets(lemma)[:2]:
            for name in syn.lemma_names()[:4]:
                name = name.lower()
                if "_" not in name and name != lemma:
                    names.add(name)
        result = tuple(sorted(names))
        self._wn_cache[lemma] = result
        return result

    def classify(self, proc: Processed, queries: list[dict[str, float]]) -> list[tuple[str, float]]:
        content = proc.content
        if not content:
            return [(label, 0.0) for label in self.intent_labels]
        dist = self.classifier.prob_classify(self._nb_features(content))
        nearest: dict[str, float] = defaultdict(float)
        for label, score in zip(self.phrase_labels, self.phrase_index.best_scores(queries)):
            nearest[label] = max(nearest[label], score)
        cued = self._cued_intents(proc)
        blended = {}
        for label in self.intent_labels:
            nb, near = dist.prob(label), nearest.get(label, 0.0)
            score = 0.5 * nb + 0.5 * near
            if near >= 0.95:
                score = max(score, 0.9 * near)
            if label in cued:
                score = min(1.0, score + CUE_BOOST)
            blended[label] = score
        return sorted(blended.items(), key=lambda kv: kv[1], reverse=True)

    def _cued_intents(self, proc: Processed) -> set[str]:
        hay = f" {proc.normalised} | {' '.join(proc.tokens)} | {' '.join(proc.lemmas)} "
        return {label for label, pattern in _CUE_PATTERNS.items() if pattern.search(hay)}

    def rank_faqs(self, query: list[dict[str, float]]) -> list[tuple[Faq, float]]:
        if not self.faqs:
            return []
        q_scores = self.faq_q.best_scores(query)
        a_scores = self.faq_a.best_scores(query)
        ranked = [(f, 0.65 * qs + 0.35 * as_) for f, qs, as_ in zip(self.faqs, q_scores, a_scores)]
        return sorted(ranked, key=lambda x: x[1], reverse=True)

    def rank_parts(self, query: list[dict[str, float]]) -> list[tuple[Part, float]]:
        if not self.parts:
            return []
        ranked = list(zip(self.parts, self.part_index.best_scores(query)))
        return sorted(ranked, key=lambda x: x[1], reverse=True)

    def rank_targets(self, query: list[dict[str, float]]) -> dict[str, float]:
        return {t.key: s for t, s in zip(TARGETS, self.target_index.best_scores(query))}

    def entities(self, message: str) -> dict:
        parts = []
        for m in _PART_TOKEN.finditer(message):
            for p in self.part_numbers.get(m.group(0).upper(), []):
                if p not in parts:
                    parts.append(p)
        boilers = sorted({f"BM-{int(n):04d}" for n in _BOILER_CODE.findall(message)})
        refs = sorted({r.upper() for r in _REFERENCE.findall(message)})
        return {"parts": parts, "boilers": boilers, "references": refs}

    def analyze(self, message: str, ctx: UserContext, has_image: bool = False) -> dict:
        proc = self.text.process(message)
        intents = self.classify(proc, self.expand(proc.content))
        top_intent, top_conf = intents[0] if intents else ("unknown", 0.0)
        query = self.expand(self._terms(proc.content))
        faqs = self.rank_faqs(query)
        parts = self.rank_parts(query)
        target_scores = self.rank_targets(query)
        ents = self.entities(message)

        result = {
            "mode": "assist",
            "source": None,
            "answer": None,
            "intent": top_intent,
            "confidence": round(top_conf, 3),
            "intents": [[label, round(score, 3)] for label, score in intents[:3]],
            "normalized": " ".join(proc.tokens),
            "corrections": proc.corrections,
            "faqs": [
                {"id": f.id, "question": f.question, "score": round(s, 3)} for f, s in faqs[:3] if s >= FAQ_CONTEXT
            ],
            "parts": [],
            "links": [],
            "entities": {
                "part_numbers": [p.part_number for p in ents["parts"]],
                "boilers": ents["boilers"],
                "references": ents["references"],
            },
            "context": "",
        }

        scored = [(p, 1.0) for p in ents["parts"]]
        scored += [(p, s) for p, s in parts[:5] if s >= PART_CONTEXT and p not in ents["parts"]]
        matched_parts = [p for p, _ in scored]
        result["parts"] = [self._part_json(p, ctx, s) for p, s in scored]

        answer, links, source = (None, [], None)
        if not has_image:
            answer, links, source = self._direct_answer(proc, intents, faqs, ents, ctx, target_scores)
        if answer:
            result["mode"] = "direct"
            result["source"] = source
            result["answer"] = answer
            result["links"] = links
        else:
            result["context"] = self._llm_context(proc, intents, faqs, matched_parts, ctx, target_scores, has_image)
        return result

    def _part_json(self, p: Part, ctx: UserContext, score: float) -> dict:
        boiler = self._visible_boiler_for(p, ctx)
        return {
            "id": p.ids[0] if p.ids else None,
            "part_number": p.part_number or None,
            "name": p.name,
            "description": p.description or None,
            "score": round(score, 3),
            "boiler_id": boiler["id"] if boiler else None,
            "boiler_code": boiler.get("code") if boiler else None,
        }

    def _direct_answer(self, proc, intents, faqs, ents, ctx, target_scores):
        """Return (answer, links, source) when the NLP layer can answer on its own."""
        asks_why = self._question_type(proc.tokens) == "why"
        faqs = [
            (f, sc) for f, sc in faqs
            if self._question_type(proc.tokens) is None or (self.faq_qtype.get(f.id) == "why") == asks_why
        ]
        top, conf = intents[0] if intents else ("unknown", 0.0)
        margin = conf - (intents[1][1] if len(intents) > 1 else 0.0)
        sure = conf >= CONF_SURE or (conf >= CONF_MIN and margin >= MARGIN_MIN)
        n_content = len(proc.content)
        faq_best, faq_score = faqs[0] if faqs else (None, 0.0)
        intent_target = TARGET_BY_KEY.get(top[4:]) if top.startswith("nav:") else None
        cart = [{"label": "Cart", "href": "/app/quotes"}]

        def faq(f: Faq):
            text, links = self._faq_answer(f, ctx)
            return text, links, f"faq:{f.id}"

        if ents["parts"]:
            if top == "pricing":
                names = ", ".join(f"**{p.part_number}** ({p.name})" for p in ents["parts"])
                return f"{names}: {PRICING_ANSWER}", cart, "pricing"
            text, links = self._parts_answer(ents["parts"], ctx)
            return text, links, "parts"

        if ents["boilers"] and top not in {"pricing", "human"}:
            text, links = self._boiler_answer(ents["boilers"], ctx, top)
            return text, links, "boiler"

        if sure and top in SMALL_TALK and n_content <= 4:
            return SMALL_TALK[top], [], f"talk:{top}"
        if sure and top == "capabilities" and n_content <= 6:
            return self._capabilities(ctx), [], "talk:capabilities"
        if sure and top == "pricing":
            return PRICING_ANSWER, cart, "pricing"
        if sure and top == "human":
            return HUMAN_HANDOFF, cart, "human"

        if faq_best and faq_score >= FAQ_DIRECT and not (intent_target and conf >= 0.8 and faq_score < 0.55):
            return faq(faq_best)

        if conf >= 0.30 and not (intent_target and self._is_where_question(proc)):
            floor = max(FAQ_AFFINITY, faq_score - 0.06, 0.20 if (sure and intent_target) else 0.0)
            for f, score in faqs[:3]:
                if score >= floor and self.faq_intent.get(f.id) == top:
                    return faq(f)

        if sure and intent_target:
            text, links = self._nav_answer(intent_target, proc, ctx)
            return text, links, f"nav:{intent_target.key}"

        if sure and top == "request_status":
            text, links = self._status_answer(ents["references"], ctx)
            return text, links, "status"

        if sure and top == "current_page" and ctx.path:
            text, links = self._current_page_answer(ctx)
            if text:
                return text, links, "page"

        return None, [], None

    @staticmethod
    def _question_type(tokens: list[str]) -> str | None:
        for tok in tokens:
            if tok in _QUESTION_WORDS:
                return tok
        return None

    @staticmethod
    def _is_where_question(proc: Processed) -> bool:
        first = proc.tokens[0] if proc.tokens else ""
        return "where" in proc.tokens or "page" in proc.tokens or first in {"open", "go", "take", "show"}

    def _can_open(self, t: Target, ctx: UserContext) -> bool:
        return t.access is None or t.access in ctx.allowed

    @staticmethod
    def _link(label: str, href: str) -> str:
        return f"[{label}]({href})"

    def _boiler_href(self, boiler_id: str, tab: str, extra: str | None = None) -> str:
        href = f"/app?boiler={boiler_id}&tab={tab}"
        return f"{href}&{extra}" if extra else href

    def _visible_boiler_for(self, p: Part, ctx: UserContext) -> dict | None:
        for b in ctx.boilers:
            if str(b.get("id")) in p.boiler_ids:
                return b
        return None

    def _nav_answer(self, t: Target, proc: Processed, ctx: UserContext) -> tuple[str, list[dict]]:
        if not self._can_open(t, ctx):
            if t.staff_only and ctx.role == "customer":
                return (
                    f"**{t.label}** is only available to Boilermech staff accounts. {HUMAN_HANDOFF}",
                    [],
                )
            if t.key == "dashboard":
                return (
                    "The boiler **Dashboard** isn't enabled for your account. Your Boilermech "
                    "representative can turn it on for you. You can still use each boiler's Spare "
                    "Parts tab from [Home](/app).",
                    [{"label": "Home", "href": "/app"}],
                )
            return (
                f"Your account doesn't have access to **{t.label}**. Your Boilermech representative "
                "can enable it for you.",
                [],
            )

        sub = self._pick_sub(t, proc)
        text = t.how
        if sub and sub.note:
            text = f"{text} Then {sub.note}."

        if t.needs_boiler:
            boilers = ctx.boilers
            tab = t.needs_boiler
            extra = sub.param if sub else None
            label = f"{t.label} → {sub.label}" if sub and sub.param else t.label
            if not boilers:
                return (
                    "Your account doesn't have any boilers assigned yet, so there is nothing to show "
                    "here. Please contact your Boilermech representative to have your projects "
                    "assigned.",
                    [],
                )
            if len(boilers) == 1:
                b = boilers[0]
                href = self._boiler_href(str(b["id"]), tab, extra)
                link_label = "{} {}".format(b.get("code") or "Boiler", label)
                return f"{text}\n\nOpen: {self._link(link_label, href)}", [{"label": link_label, "href": href}]
            codes = ", ".join(str(b.get("code")) for b in boilers[:6] if b.get("code"))
            more = " (and more)" if len(boilers) > 6 else ""
            return (
                f"{text}\n\nYou have {len(boilers)} boilers ({codes}{more}). Open: "
                f"{self._link('Home', '/app')} and choose one, or tell me the boiler code "
                "(e.g. BM-0001) and I'll link it directly.",
                [{"label": "Home", "href": "/app"}],
            )

        href = sub.href if sub and sub.href else t.href
        label = sub.label if sub and sub.href else t.label
        if href:
            return f"{text}\n\nOpen: {self._link(label, href)}", [{"label": label, "href": href}]
        return text, []

    def _pick_sub(self, t: Target, proc: Processed):
        if not t.subs:
            return None
        hay = " " + " ".join(proc.tokens) + " " + " ".join(proc.lemmas) + " "
        best, best_len = None, 0
        for sub in t.subs:
            for cue in sub.cues:
                if f" {cue}" in hay and len(cue) > best_len:
                    best, best_len = sub, len(cue)
        return best

    _FAQ_LINKS = (
        ("cart", re.compile(r"\bcart\b", re.I)),
        ("history", re.compile(r"\bhistory\b", re.I)),
        ("profile", re.compile(r"\bprofile\b", re.I)),
        ("home", re.compile(r"\bhome page\b", re.I)),
    )

    def _faq_answer(self, faq: Faq, ctx: UserContext) -> tuple[str, list[dict]]:
        links = []
        for key, pattern in self._FAQ_LINKS:
            t = TARGET_BY_KEY[key]
            if pattern.search(faq.answer) and self._can_open(t, ctx) and t.href:
                links.append({"label": t.label, "href": t.href})
            if len(links) == 2:
                break
        text = faq.answer.strip()
        if links:
            text += "\n\nOpen: " + " · ".join(self._link(l["label"], l["href"]) for l in links)
        return text, links

    def _parts_answer(self, parts: list[Part], ctx: UserContext) -> tuple[str, list[dict]]:
        lines, links = [], []
        for p in parts[:5]:
            desc = f" ({p.description})" if p.description and p.description.lower() != p.name.lower() else ""
            line = f"• **{p.part_number}** — {p.name}{desc}"
            boiler = self._visible_boiler_for(p, ctx)
            if boiler and "parts" in ctx.allowed:
                href = self._boiler_href(str(boiler["id"]), "parts")
                link_label = "{} Spare Parts".format(boiler.get("code") or "Boiler")
                line += f" — {self._link(link_label, href)}"
                links.append({"label": link_label, "href": href})
            lines.append(line)
        tail = (
            "Search for the part number in the Spare Parts tab and click **Add** to put it in your "
            "Cart. Pricing and availability are confirmed on your quotation."
        )
        if not links:
            tail = (
                "This part isn't listed under the boilers assigned to your account. Submit a "
                "request from your [Cart](/app/quotes) with a note, or ask your Boilermech "
                "representative."
            )
        return "\n".join(lines) + "\n\n" + tail, links

    def _boiler_answer(self, codes: list[str], ctx: UserContext, top: str):
        by_code = {str(b.get("code", "")).upper(): b for b in ctx.boilers}
        found = [by_code[c] for c in codes if c in by_code]
        missing = [c for c in codes if c not in by_code]
        if not found:
            return (
                f"{', '.join(codes)} isn't one of the boilers assigned to your account. If it should "
                "be, please contact your Boilermech representative.",
                [],
            )
        tab = "dashboard" if top == "nav:dashboard" and "dashboard" in ctx.allowed else "parts"
        if tab == "parts" and "parts" not in ctx.allowed and "dashboard" in ctx.allowed:
            tab = "dashboard"
        label = "Dashboard" if tab == "dashboard" else "Spare Parts"
        links = [
            {"label": f"{b.get('code')} {label}", "href": self._boiler_href(str(b["id"]), tab)} for b in found
        ]
        text = "Here you go: " + " · ".join(self._link(l["label"], l["href"]) for l in links)
        if missing:
            text += f"\n\n{', '.join(missing)} isn't assigned to your account."
        return text, links

    def _status_answer(self, refs: list[str], ctx: UserContext) -> tuple[str, list[dict]]:
        ref = f" and search for **{refs[0]}**" if refs else ""
        text = (
            "I can't see the details of individual requests. Open [History](/app/history), go to "
            f"the **Requests** tab{ref}. Each request shows its status: it stays open while our "
            "team reviews it and is marked closed once it has been handled. Requests are reviewed "
            "Monday to Friday, 8:30am to 6:00pm."
        )
        links = [{"label": "History", "href": "/app/history"}]
        if "requests" in ctx.allowed:
            text += " Open customer requests are on the [Requests](/app/requests) page."
            links.append({"label": "Requests", "href": "/app/requests"})
        return text, links

    def _current_page_answer(self, ctx: UserContext) -> tuple[str, list[dict]]:
        t = self._target_for_path(ctx.path)
        if not t:
            return None, []
        tab = re.search(r"[?&]tab=(\w+)", ctx.path)
        if t.key == "home" and tab and tab.group(1) in TARGET_BY_KEY:
            t = TARGET_BY_KEY[tab.group(1)]
        return f"You're on **{t.label}**. {t.summary} {t.how}", []

    @staticmethod
    def _target_for_path(path: str) -> Target | None:
        clean = (path or "").split("?")[0].rstrip("/") or "/"
        for prefix, key in PATH_PREFIXES:
            if clean == prefix or clean.startswith(prefix + "/"):
                return TARGET_BY_KEY[key]
        return None

    def _capabilities(self, ctx: UserContext) -> str:
        pages = [t for t in TARGETS if t.href and self._can_open(t, ctx) and t.key not in {"password"}]
        page_links = ", ".join(self._link(t.label, t.href) for t in pages[:8])
        return (
            "I can help you find your way around BME e-Serve (try \"where is my cart?\" or "
            "\"how do I change my password?\"), answer questions about how requests work, look up "
            "spare parts by name or part number, and identify a part from a photo you upload. "
            f"Pages you can open: {page_links}."
        )

    def _llm_context(self, proc, intents, faqs, parts, ctx, target_scores, has_image) -> str:
        lines = [
            "",
            "",
            "NLP analysis of the user's latest message (from the e-Serve NLP service). "
            "Treat these app facts as authoritative:",
        ]
        if proc.corrections:
            fixes = ", ".join(f"{a} → {b}" for a, b in proc.corrections.items())
            lines.append(f"- Likely typos corrected: {fixes}")
        top3 = ", ".join(f"{label} ({score:.2f})" for label, score in intents[:3])
        lines.append(f"- Most likely intents: {top3}")
        current = self._target_for_path(ctx.path)
        if current:
            lines.append(f"- The user is currently on: {current.label} ({ctx.path})")
        lines.append(f"- User role: {ctx.role}")

        lines.append("App map for this user (link ONLY these paths, exactly as written):")
        for t in TARGETS:
            if not t.href or not self._can_open(t, ctx) or t.key == "password":
                continue
            if t.needs_boiler:
                lines.append(f"- {t.label}: open a boiler from [Home](/app), then its {t.label} tab. {t.summary}")
            else:
                lines.append(f"- [{t.label}]({t.href}): {t.summary}")
        hidden = [t.label for t in TARGETS if t.href and not self._can_open(t, ctx)]
        if hidden:
            lines.append(f"- Not available to this user (do not offer them): {', '.join(hidden)}")
        if ctx.boilers:
            shown = ", ".join(
                f"{b.get('code')} [{b.get('code')} Spare Parts](/app?boiler={b.get('id')}&tab=parts)"
                for b in ctx.boilers[:8]
            )
            lines.append(f"- Boilers assigned to this user: {shown}")
        elif ctx.role == "customer":
            lines.append("- This user has no boilers assigned yet.")

        nav = [
            TARGET_BY_KEY[label[4:]] for label, score in intents[:3] if label.startswith("nav:") and score >= 0.25
        ]
        nav_extra = sorted(target_scores.items(), key=lambda kv: kv[1], reverse=True)[:2]
        for key, score in nav_extra:
            if score >= 0.2 and TARGET_BY_KEY[key] not in nav:
                nav.append(TARGET_BY_KEY[key])
        nav = [t for t in nav if self._can_open(t, ctx)]
        if nav:
            lines.append("How-to for the pages this message is most likely about:")
            for t in nav[:3]:
                lines.append(f"- {t.label}: {t.how}")

        useful = [(f, s) for f, s in faqs[:3] if s >= FAQ_CONTEXT]
        if useful:
            lines.append("Official FAQ entries that may answer this (prefer their wording):")
            for f, s in useful:
                lines.append(f"Q: {f.question}\nA: {f.answer}")

        if parts:
            lines.append(
                "Catalogue parts matching the message by keyword (suggest ONLY real catalogue parts):"
            )
            for p in parts[:6]:
                num = p.part_number or "(no part number yet)"
                desc = f" - {p.description}" if p.description else ""
                boiler = self._visible_boiler_for(p, ctx)
                where = (
                    f" [{boiler.get('code')} Spare Parts](/app?boiler={boiler.get('id')}&tab=parts)"
                    if boiler and "parts" in ctx.allowed
                    else ""
                )
                lines.append(f"- {num} | {p.name}{desc}{where}"[:260])
        if has_image:
            lines.append("- The user attached a photo; identify the part from the image.")
        return "\n".join(lines)