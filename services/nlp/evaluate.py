from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

from dotenv import load_dotenv

from nlp_engine import Engine, UserContext, ensure_nltk_data

CUSTOMER = "customer"
STAFF = "staff"

CASES: list[tuple[str, str, str]] = [
    ("where do i find my cart", "nav:cart|faq~How do I request a quotation", CUSTOMER),
    ("take me to the cart page", "nav:cart", CUSTOMER),
    ("show me the stuff i added", "nav:cart|assist", CUSTOMER),
    ("how can i send the quotation request", "faq~How do I request a quotation|nav:cart", CUSTOMER),
    ("where can i view my earlier quotations", "nav:history|faq~How do I track", CUSTOMER),
    ("i want to see my previous requests", "nav:history|faq~How do I track", CUSTOMER),
    ("how to reorder the parts i bought last time", "faq~How do I order the same parts again", CUSTOMER),
    ("can i repeat my last order", "faq~How do I order the same parts again|nav:history", CUSTOMER),
    ("where is my profile page", "nav:profile", CUSTOMER),
    ("how do i update my phone no", "nav:profile|faq~How do I update my profile", CUSTOMER),
    ("i want to change my company address", "nav:profile|faq~How do I update my profile", CUSTOMER),
    ("how do i change my pasword", "nav:password|faq~How do I update my profile", CUSTOMER),
    ("i forgot my password what should i do", "nav:password|faq~How do I update my profile", CUSTOMER),
    ("what are the password rules", "nav:password|faq~How do I update my profile", CUSTOMER),
    ("where is the parts catalogue", "nav:parts|faq~How do I find the part", CUSTOMER),
    ("how do i search a part by its number", "nav:parts|faq~How do I find the part", CUSTOMER),
    ("how do i use the schematic", "nav:parts|faq~How do I find the part", CUSTOMER),
    ("how do i put a part into my cart", "nav:parts|faq~How do I request a quotation|nav:cart", CUSTOMER),
    ("where are my boilers", "nav:home|faq~Why can I only see", CUSTOMER),
    ("go back to home", "nav:home", CUSTOMER),
    ("where is the faq", "nav:faq", CUSTOMER),
    ("show me the terms and conditions", "nav:policy", CUSTOMER),
    ("how is my personal data handled", "nav:policy|assist", CUSTOMER),
    ("how do i turn on dark mode", "faq~Can I use the app in dark mode|nav:theme", CUSTOMER),
    ("the app is too bright can i make it darker", "faq~Can I use the app in dark mode|nav:theme|assist", CUSTOMER),
    ("how do i log out", "nav:signout", CUSTOMER),
    ("why did the app log me out", "faq~Why was I signed out|nav:signout", CUSTOMER),
    ("where can i see my notifications", "nav:notifications|faq~What are the suggested parts", CUSTOMER),
    ("what are suggested parts", "faq~What are the suggested parts|nav:notifications", CUSTOMER),
    ("how do i add a new user", "nav:settings", CUSTOMER),
    ("where is the audit log", "nav:analytics", CUSTOMER),
    ("show me pending customer requests", "nav:requests|assist", CUSTOMER),
    ("where is the boiler dashboard", "nav:dashboard", CUSTOMER),
    ("how do i invite a customer account", "nav:settings", STAFF),
    ("where can i turn on maintenance mode", "nav:settings", STAFF),
    ("where do i edit the faqs", "nav:settings", STAFF),
    ("where are the unreplied enquiries", "nav:enquiries", STAFF),
    ("which customer requests are waiting for review", "nav:requests", STAFF),
    ("did the quotation email get delivered", "nav:analytics|assist", STAFF),
    ("who logged in today", "nav:analytics", STAFF),
    ("show me the alerts for the boiler", "nav:dashboard", STAFF),
    ("where do i record the daily log sheet", "nav:dashboard", STAFF),
    ("where can i check motor vibration", "nav:dashboard", STAFF),
    ("can i attach a drawing to my request", "faq~Can I attach files", CUSTOMER),
    ("what file types can i upload", "faq~Can I attach files|assist", CUSTOMER),
    ("how long until someone replies to my request", "faq~How long does it take", CUSTOMER),
    ("what are your working hours", "faq~How long does it take|assist", CUSTOMER),
    ("why are some boilers missing from my list", "faq~Why can I only see", CUSTOMER),
    ("i cant see all my boilers", "faq~Why can I only see", CUSTOMER),
    ("can the bot recognise a part from a picture", "faq~Can the assistant identify", CUSTOMER),
    ("how do i check the status of my quote", "faq~How do I track|status", CUSTOMER),
    ("has my request BME-2026-0042 been closed", "status|faq~How do I track", CUSTOMER),
    ("what is the others tab", "faq~What is the Others tab", CUSTOMER),
    ("how much does a safety valve cost", "pricing", CUSTOMER),
    ("is the mobrey level switch in stock", "pricing", CUSTOMER),
    ("what's the price of 2VLBD40040", "pricing", CUSTOMER),
    ("can i get a discount", "pricing", CUSTOMER),
    ("i want to speak to someone from boilermech", "human", CUSTOMER),
    ("how can i contact your sales team", "human|faq~I have a question that is not answered", CUSTOMER),
    ("good morning", "talk:greeting", CUSTOMER),
    ("hello there", "talk:greeting", CUSTOMER),
    ("thank you very much", "talk:thanks", CUSTOMER),
    ("ok bye", "talk:goodbye", CUSTOMER),
    ("what can you help me with", "talk:capabilities", CUSTOMER),
    ("2TEM260006", "parts", CUSTOMER),
    ("do you have part 2vlbd00015", "parts", CUSTOMER),
    ("open bm-0002", "boiler", CUSTOMER),
    ("show me the parts for BM 0001", "boiler", CUSTOMER),
    ("open BM-0009", "boiler", CUSTOMER),
    ("i need a new pressure gauge", "assist", CUSTOMER),
    ("which valve controls the water level", "assist", CUSTOMER),
    ("my gauge glass is cracked what do i need", "assist", CUSTOMER),
    ("what does a dp transmitter do", "assist", CUSTOMER),
    ("why is my boiler producing black smoke", "assist", CUSTOMER),
    ("yes please", "assist", CUSTOMER),
    ("what about the other one", "assist", CUSTOMER),
    ("explain how a biomass boiler works", "assist", CUSTOMER),
    ("hw do i submitt my quote", "faq~How do I request a quotation|nav:cart", CUSTOMER),
    ("where's the basket", "nav:cart", CUSTOMER),
    ("i added parts but where are they now", "nav:cart|assist", CUSTOMER),
    ("can i change the qty before sending", "nav:cart|faq~How do I request a quotation|assist", CUSTOMER),
    ("where to see my old requests", "nav:history|faq~How do I track", CUSTOMER),
    ("order again the same items as last month", "faq~How do I order the same parts again|nav:history", CUSTOMER),
    ("how to edit my email", "nav:profile|faq~How do I update my profile", CUSTOMER),
    ("reset password", "nav:password|faq~How do I update my profile", CUSTOMER),
    ("i need to change my password because it expired", "nav:password|faq~How do I update my profile", CUSTOMER),
    ("how to find a valve in the catalogue", "nav:parts|faq~How do I find the part|assist", CUSTOMER),
    ("where is the diagram of the boiler", "nav:parts", CUSTOMER),
    ("switch to light theme", "nav:theme|faq~Can I use the app in dark mode", CUSTOMER),
    ("how to sign out", "nav:signout", CUSTOMER),
    ("why do i keep getting logged out", "faq~Why was I signed out|nav:signout", CUSTOMER),
    ("where can i read the privacy policy", "nav:policy", CUSTOMER),
    ("my boiler is not in the list", "faq~Why can I only see|assist", CUSTOMER),
    ("how fast do you respond", "faq~How long does it take|status|assist", CUSTOMER),
    ("whats the status of BME-2026-0107", "status|faq~How do I track", CUSTOMER),
    ("can i send a photo of the part", "faq~Can the assistant identify|faq~Can I attach files|assist", CUSTOMER),
    ("berapa harga pressure gauge", "pricing", CUSTOMER),
    ("whats the cost", "pricing", CUSTOMER),
    ("when will the parts be delivered", "pricing|assist", CUSTOMER),
    ("can i talk to a real person", "human", CUSTOMER),
    ("hi", "talk:greeting", CUSTOMER),
    ("thanks a lot", "talk:thanks", CUSTOMER),
    ("2VLSF35001", "parts", CUSTOMER),
    ("show me BM-0001", "boiler", CUSTOMER),
    ("where do i manage users", "nav:settings", CUSTOMER),
    ("how do i assign a boiler to a customer", "nav:settings", STAFF),
    ("where can i post an announcement", "nav:settings", STAFF),
    ("show me the email log", "nav:analytics", STAFF),
    ("which enquiries havent been answered", "nav:enquiries", STAFF),
    ("where are the boiler alerts", "nav:dashboard", STAFF),
    ("upcoming maintenance for BM-0003", "boiler", STAFF),
    ("the steam pressure keeps dropping what should i check", "assist", CUSTOMER),
    ("compare the 4 inch and 6 inch pressure gauge", "assist", CUSTOMER),
    ("what is a mobrey level control used for", "assist", CUSTOMER),
    ("no", "assist", CUSTOMER),
]

def outcome(result: dict, engine: Engine) -> str:
    if result["mode"] != "direct":
        return "assist"
    source = result["source"] or ""
    if source.startswith("faq:"):
        fid = source[:4]
        q = next((f.question for f in engine.faqs if f.id == fid), fid)
        return f"faq:{q}"
    return source

def matches(got: str, expected: str) -> bool:
    for exp in expected.split("|"):
        if exp.startswith("faq~") and got.startswith("faq:") and got[4:].lower().startswith(exp[4:].lower()):
            return True
        if got == exp:
            return True
    return False

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixtures", type=Path)
    parser.add_argument("-v", "--verbose", action="store_true")
    parser.add_argument("--strict", action="store_true", help="exit 1 if any wrong direct answer")
    args = parser.parse_args()
    logging.basicConfig(level=logging.WARNING)

    resources = ensure_nltk_data(download=True)
    if args.fixtures:
        data = json.loads(args.fixtures.read_text(encoding="utf-8"))
        faqs, parts, boilers = data["faqs"], data["parts"], data.get("boilers", [])
    else:
        load_dotenv(Path(__file__).with_name(".env"))
        from data_source import load_data

        faqs, parts = load_data()
        boilers = sorted(
            {(p["boiler_id"], "") for p in parts if p.get("boiler_id")}, key=lambda b: b[0]
        )
        boilers = [{"id": b, "code": f"BM-{i + 1:04d}", "name": ""} for i, (b, _) in enumerate(boilers)]

    engine = Engine(faqs, parts, resources)
    users = {
        CUSTOMER: UserContext(CUSTOMER, {"home", "parts", "cart", "history", "profile"}, boilers[:2], "/app"),
        STAFF: UserContext(STAFF, {"home", "parts", "dashboard", "cart", "history", "profile", "requests", "enquiries", "analytics", "settings"}, boilers, "/app"),
    }

    passed, failures, wrong_direct = 0, [], 0
    for question, expected, role in CASES:
        result = engine.analyze(question, users[role])
        got = outcome(result, engine)
        ok = matches(got, expected)
        passed += ok
        if not ok:
            failures.append((question, expected, got, result))
            wrong_direct += got != "assist"
        if args.verbose:
            mark = "PASS" if ok else "FAIL"
            print(f"[{mark}] ({role}) {question}\n -> {got} intent={result['intent']} conf={result['confidence']}")

    total = len(CASES)
    safe = len(failures) - wrong_direct
    print(f"\nAnswered as expected: {passed}/{total} ({passed / total:.0%})")
    print(f"Safe fallback to the LLM: {safe} (sent to Claude with NLP context instead)")
    print(f"Wrong direct answers: {wrong_direct} (the number to keep near zero)")
    for question, expected, got, result in failures:
        kind = "fallback" if got == "assist" else "WRONG"
        faqs_seen = ", ".join(f"{f['question'][:35]}={f['score']}" for f in result["faqs"])
        print(
            f"[{kind}] {question!r}\n expected {expected}\n got {got}"
            f"(intents={result['intents']}; faqs: {faqs_seen})"
        )
    return 1 if args.strict and wrong_direct else 0

if __name__ == "__main__":
    sys.exit(main())