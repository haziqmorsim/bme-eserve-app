from __future__ import annotations

from dataclasses import dataclass, field

HUMAN_HANDOFF = (
    "To reach our team, submit a request from your [Cart](/app/quotes) and add a note "
    "describing what you need, or contact your Boilermech representative. Every request "
    "is reviewed by the team during business hours."
)

@dataclass(frozen=True)
class SubLink:
    label: str
    cues: tuple[str, ...]
    href: str | None = None
    param: str | None = None
    note: str = ""

@dataclass(frozen=True)
class Target:
    key: str
    label: str
    href: str | None
    access: str | None
    summary: str
    how: str
    phrases: tuple[str, ...]
    subs: tuple[SubLink, ...] = field(default_factory=tuple)
    needs_boiler: str | None = None
    staff_only: bool = False

TARGETS: tuple[Target, ...] = (
    Target(
        key="home",
        label="Home",
        href="/app",
        access="home",
        summary="Home lists your projects and the boilers assigned to you.",
        how=(
            "Your projects and boilers are listed on the left. Choose a boiler to open it; "
            "its Spare Parts tab (and Dashboard tab, if your account has one) appears on the right."
        ),
        phrases=(
            "go to the home page",
            "take me home",
            "where is the home page",
            "open the main page",
            "show me my boilers",
            "where can i see my boilers",
            "list of my boilers",
            "where are my projects",
            "how do i open a boiler",
            "how do i select a boiler",
            "back to the start page",
            "main screen",
            "which boilers do i have",
            "my projects and boilers",
        ),
    ),
    Target(
        key="parts",
        label="Spare Parts",
        href="/app",
        access="parts",
        needs_boiler="parts",
        summary="Each boiler's Spare Parts tab is the parts catalogue for that boiler.",
        how=(
            "Open a boiler from Home and go to its **Spare Parts** tab. Click a highlighted "
            "section of the Boiler Schematic to list that section's parts (dimmed sections have "
            "none), or search by part number, name or description. Click a part's photo to "
            "enlarge it, and click **Add** to put it in your Cart."
        ),
        phrases=(
            "where can i find spare parts",
            "how do i search for a part",
            "show me the parts catalogue",
            "where is the parts list",
            "how to look up a part number",
            "browse spare parts",
            "find parts for my boiler",
            "where is the boiler schematic",
            "how do i add a part to my cart",
            "how to add parts",
            "spare parts page",
            "parts catalog",
            "search parts by name",
            "the diagram with the highlighted sections",
            "add item to cart",
        ),
    ),
    Target(
        key="dashboard",
        label="Dashboard",
        href="/app",
        access="dashboard",
        needs_boiler="dashboard",
        summary="A boiler's Dashboard shows its live readings, alerts and maintenance.",
        how=(
            "Open a boiler from Home and go to its **Dashboard** tab. The sub-tabs are Overview, "
            "Trends, Motors, Alerts, Analytics, Indicators, Inspection, Log Sheet, Programme "
            "and Maintenance."
        ),
        phrases=(
            "where is the boiler dashboard",
            "show me the dashboard",
            "where can i see boiler readings",
            "boiler performance",
            "where are the alerts for my boiler",
            "show me the trends",
            "where can i see motor vibration",
            "where is the maintenance schedule",
            "upcoming maintenance",
            "where do i fill in the daily log sheet",
            "annual inspection results",
            "where are the boiler indicators",
            "steam pressure readings",
            "boiler health",
            "programme actions overdue",
            "live telemetry",
        ),
        subs=(
            SubLink("Overview", ("overview", "summary"), param="sub=overview"),
            SubLink("Trends", ("trend", "chart", "graph", "history reading"), param="sub=trends"),
            SubLink("Motors", ("motor", "vibration", "current", "amp", "kw"), param="sub=motors"),
            SubLink("Alerts", ("alert", "alarm", "warning"), param="sub=alerts"),
            SubLink("Indicators", ("indicator",), param="sub=indicators"),
            SubLink("Inspection", ("inspection", "inspect", "tube thickness", "finding"), param="sub=inspection"),
            SubLink("Log Sheet", ("log sheet", "logsheet", "daily log", "log"), param="sub=logsheet"),
            SubLink("Programme", ("programme", "program", "action", "kpi"), param="sub=programme"),
            SubLink("Maintenance", ("maintenance", "service", "due"), param="sub=maintenance"),
        ),
    ),
    Target(
        key="cart",
        label="Cart",
        href="/app/quotes",
        access="cart",
        summary="The Cart holds the parts you have added, ready to send as a quotation request.",
        how=(
            "In the **Cart**, check the quantities, add notes (delivery site, urgency, PO "
            "reference) and any attachments, then click **Submit**. Attachments can be PDF, "
            "Word, Excel, CSV, text files or images (PNG, JPG, WEBP), up to 10 MB in total."
        ),
        phrases=(
            "where is my cart",
            "open the cart",
            "how do i submit a quotation request",
            "how do i request a quote",
            "send my request",
            "where is the quote list",
            "check out my parts",
            "how to change the quantity",
            "remove an item from the cart",
            "attach a purchase order",
            "upload a drawing with my request",
            "add notes to my request",
            "get a quotation",
            "submit my order",
            "items i added",
            "basket",
        ),
    ),
    Target(
        key="history",
        label="History",
        href="/app/history",
        access="history",
        summary="History lists the requests you have submitted and their status.",
        how=(
            "Open **History** and go to the **Requests** tab. Each request shows its reference "
            "number, status, submission date, and the parts, notes and attachments you sent. "
            "You can search by reference number or part, and click **Request Again** to add an "
            "earlier request's parts back to your Cart."
        ),
        phrases=(
            "where are my past requests",
            "show my previous quotations",
            "request history",
            "where can i see what i ordered before",
            "how do i order the same parts again",
            "reorder parts",
            "request again",
            "my old quotes",
            "list of my submitted requests",
            "where do i find my quotation pdf",
            "past orders",
            "see requests i sent",
            "repeat a previous order",
        ),
    ),
    Target(
        key="profile",
        label="Profile",
        href="/app/profile",
        access="profile",
        summary="Profile holds your personal details and address.",
        how=(
            "Open **Profile** (the person icon at the top right) and click **Edit Profile** to "
            "update your name, company, e-mail, phone number and address."
        ),
        phrases=(
            "where is my profile",
            "edit my profile",
            "update my phone number",
            "change my email address",
            "change my company name",
            "update my address",
            "my account details",
            "personal information",
            "change my name",
            "where are my account settings",
        ),
    ),
    Target(
        key="password",
        label="Change Password",
        href="/app/profile",
        access="profile",
        summary="You change your password from your Profile.",
        how=(
            "Open **Profile**, click **Change Password**, then enter your current password and "
            "a new one. A new password needs at least 8 characters, including a capital letter, "
            "a number and a symbol. If you have forgotten it, sign out and use **Forgot "
            "password?** on the sign-in page."
        ),
        phrases=(
            "change my password",
            "how do i reset my password",
            "update password",
            "forgot my password",
            "new password",
            "password requirements",
            "my password expired",
            "set a different password",
            "password rules",
        ),
    ),
    Target(
        key="requests",
        label="Requests",
        href="/app/requests",
        access="requests",
        staff_only=True,
        summary="Requests lists customers' quotation requests that are awaiting action.",
        how=(
            "Open **Requests** to see open customer requests with their reference, customer, "
            "SLA badge and timeline. Search by reference or customer, and filter by region."
        ),
        phrases=(
            "where are the customer requests",
            "pending requests to review",
            "requests awaiting action",
            "how do i close a request",
            "review customer quotations",
            "open requests from customers",
            "approve a request",
            "which requests are overdue",
            "sla for requests",
        ),
    ),
    Target(
        key="enquiries",
        label="Enquiries",
        href="/app/enquiries",
        access="enquiries",
        staff_only=True,
        summary="Enquiries holds general enquiries sent from the sign-in page.",
        how="Open **Enquiries**; they are split into **Unreplied** and **Replied** tabs.",
        phrases=(
            "where are the general enquiries",
            "unreplied enquiries",
            "reply to an enquiry",
            "enquiries from new customers",
            "messages from the enquiry form",
            "replied enquiries",
        ),
    ),
    Target(
        key="analytics",
        label="Analytics",
        href="/app/analytics",
        access="analytics",
        staff_only=True,
        summary="Analytics holds reporting pages for staff.",
        how=(
            "Open **Analytics**. Its pages are Audit Log, Customer Requests, E-mail Deliveries "
            "and User Activities."
        ),
        phrases=(
            "where are the analytics",
            "show me reports",
            "audit log",
            "who changed this record",
            "email delivery log",
            "did the email send",
            "user activities",
            "who logged in",
            "customer request statistics",
            "reporting",
            "usage statistics",
        ),
        subs=(
            SubLink("Audit Log", ("audit", "changed", "change log", "who edited"), href="/app/analytics/audit-log"),
            SubLink("Customer Requests", ("customer request", "request statistic", "funnel"), href="/app/analytics/customer-requests"),
            SubLink("E-mail Deliveries", ("email", "e-mail", "mail", "deliver", "sent"), href="/app/analytics/email-log"),
            SubLink("User Activities", ("activity", "activities", "logged in", "login", "sign in", "usage"), href="/app/analytics/user-activities"),
        ),
    ),
    Target(
        key="settings",
        label="Settings",
        href="/app/settings",
        access="settings",
        staff_only=True,
        summary="Settings is where staff manage projects, boilers, parts, users, app settings and FAQs.",
        how=(
            "Open **Settings** (top right). Its tabs are Projects, Boilers, Parts, Users, "
            "General and FAQ."
        ),
        phrases=(
            "where are the settings",
            "add a new user",
            "invite a customer",
            "manage users",
            "assign a boiler to a customer",
            "edit the faq",
            "add a part to the catalogue",
            "turn on maintenance mode",
            "change the chatbot limit",
            "post an announcement",
            "create a project",
            "edit boiler details",
            "admin settings",
            "general settings",
        ),
        subs=(
            SubLink("Projects", ("project",), note="open the **Projects** tab"),
            SubLink("Boilers", ("boiler",), note="open the **Boilers** tab"),
            SubLink("Parts", ("part", "catalogue", "catalog"), note="open the **Parts** tab"),
            SubLink("Users", ("user", "customer", "invite", "account", "assign"), note="open the **Users** tab"),
            SubLink("General", ("maintenance mode", "announcement", "chatbot", "limit", "sla", "reference", "general", "what's new"), note="open the **General** tab"),
            SubLink("FAQ", ("faq", "question"), note="open the **FAQ** tab"),
        ),
    ),
    Target(
        key="faq",
        label="FAQ",
        href="/app/faq",
        access=None,
        summary="The FAQ page answers common questions about the app.",
        how="The **FAQ** link is in the footer at the bottom of every page.",
        phrases=(
            "where is the faq",
            "frequently asked questions",
            "help page",
            "open the faq page",
            "common questions",
        ),
    ),
    Target(
        key="policy",
        label="Privacy Policy",
        href="/app/policy",
        access=None,
        summary="The Privacy Policy and Terms and Conditions are on one page.",
        how="The **Privacy Policy** link is in the footer at the bottom of every page.",
        phrases=(
            "privacy policy",
            "terms and conditions",
            "how is my data used",
            "data protection",
            "terms of use",
            "where are the terms",
        ),
    ),
    Target(
        key="notifications",
        label="Notifications",
        href=None,
        access=None,
        summary="Notifications appear under the bell icon.",
        how=(
            "Click the **bell** icon at the top of the app (on a phone it is in the menu). When a "
            "section of one of your boilers needs attention, the app may suggest spare parts "
            "there: **Accept** adds them to your Cart, or decline them. Nothing is ordered until "
            "you submit a request from the Cart."
        ),
        phrases=(
            "where are my notifications",
            "what does the bell do",
            "suggested parts in my notifications",
            "accept a suggestion",
            "decline the suggested parts",
            "alerts in the bell",
            "unread notifications",
        ),
    ),
    Target(
        key="theme",
        label="Dark mode",
        href=None,
        access=None,
        summary="You can switch between light and dark mode.",
        how=(
            "Use the **light/dark toggle** at the top of the app (on a phone it is in the menu). "
            "Your choice is remembered on that device."
        ),
        phrases=(
            "dark mode",
            "switch to light mode",
            "change the theme",
            "the screen is too bright",
            "night mode",
            "change colours",
        ),
    ),
    Target(
        key="signout",
        label="Sign Out",
        href=None,
        access=None,
        summary="You sign out from the top bar.",
        how=(
            "Click **Sign Out** at the top right (on a phone it is in the menu). For security, the "
            "app also signs you out after 60 minutes of inactivity, with a warning a minute "
            "before."
        ),
        phrases=(
            "how do i log out",
            "sign out",
            "logout",
            "why was i signed out",
            "session expired",
            "it logged me out automatically",
            "stay signed in",
        ),
    ),
)

TARGET_BY_KEY = {t.key: t for t in TARGETS}

PATH_PREFIXES: tuple[tuple[str, str], ...] = (
    ("/app/quotes", "cart"),
    ("/app/history", "history"),
    ("/app/profile", "profile"),
    ("/app/requests", "requests"),
    ("/app/enquiries", "enquiries"),
    ("/app/analytics", "analytics"),
    ("/app/settings", "settings"),
    ("/app/faq", "faq"),
    ("/app/policy", "policy"),
    ("/app", "home"),
)

@dataclass(frozen=True)
class Intent:
    key: str
    phrases: tuple[str, ...]

INTENTS: tuple[Intent, ...] = (
    Intent(
        "greeting",
        (
            "hi", "hello", "hey", "good morning", "good afternoon", "good evening",
            "hi there", "hello assistant", "hey bot", "assalamualaikum", "salam",
            "selamat pagi", "yo", "morning",
        ),
    ),
    Intent(
        "thanks",
        (
            "thanks", "thank you", "thank you so much", "thanks a lot", "cheers",
            "that helped", "great thanks", "terima kasih", "appreciate it", "ok thanks",
            "perfect thank you", "awesome",
        ),
    ),
    Intent(
        "goodbye",
        ("bye", "goodbye", "see you", "that is all", "nothing else", "see you later", "bye bye", "ok bye", "thats all for now", "i am done"),
    ),
    Intent(
        "capabilities",
        (
            "what can you do", "how can you help me", "what are you", "who are you",
            "help", "what do you know", "what can i ask you", "are you a bot",
            "what is this chat for", "can you help me",
        ),
    ),
    Intent(
        "human",
        (
            "i want to talk to a person", "speak to a human", "contact support",
            "call boilermech", "talk to sales", "i need a real person", "contact your team",
            "phone number of boilermech", "customer service", "speak to my representative",
            "connect me to an agent", "how do i contact you", "whatsapp",
        ),
    ),
    Intent(
        "pricing",
        (
            "how much does it cost", "what is the price", "price of this part",
            "is it in stock", "do you have stock", "how much is a pressure gauge",
            "cost of the valve", "availability of this part", "when can it be delivered",
            "delivery time", "is there a discount", "quote me a price", "how much",
            "lead time", "price list",
        ),
    ),
    Intent(
        "request_status",
        (
            "what is the status of my request", "has my quotation been approved",
            "where is my order", "is my request closed", "did you receive my request",
            "track my request", "when will i get my quotation", "status of BME-2026-0031",
            "any update on my quote", "how long does it take to get a response",
        ),
    ),
    Intent(
        "current_page",
        (
            "where am i", "what is this page", "what page am i on", "what can i do here",
            "what does this page do", "explain this screen", "what is this screen for",
        ),
    ),
    Intent(
        "part_lookup",
        (
            "i need a pressure gauge", "do you sell safety valves", "find part 2TGP000040",
            "looking for a blowdown valve", "what is part number 2VLBD40040",
            "i need a replacement gauge glass", "which transmitter do i need",
            "part number for the level switch", "i am looking for a temperature gauge",
            "do you have a control valve", "what part is this", "identify this part",
            "replacement for a broken valve", "spare for the water level gauge",
        ),
    ),
)

SYNONYMS: dict[str, tuple[str, ...]] = {
    "buy": ("order", "request"),
    "bought": ("order", "request"),
    "purchase": ("order", "request"),
    "recognise": ("identify",),
    "recognize": ("identify",),
    "bot": ("assistant", "chat"),
    "chatbot": ("assistant", "chat"),
    "missing": ("see", "assign"),
    "reply": ("response", "respond"),
    "respond": ("response",),
    "answer": ("response",),
    "hour": ("business", "response"),
    "file": ("attachment", "attach"),
    "drawing": ("attachment", "attach"),
    "document": ("attachment", "attach"),
    "repeat": ("again", "order"),
    "earlier": ("previous", "history"),
    "last": ("previous", "again"),
    "cart": ("basket", "quote", "quotation", "checkout"),
    "basket": ("cart",),
    "quote": ("quotation", "cart", "request"),
    "quotation": ("quote", "request"),
    "order": ("request", "quotation"),
    "request": ("quotation", "order"),
    "part": ("spare", "item", "component"),
    "spare": ("part",),
    "item": ("part",),
    "logout": ("sign", "out"),
    "login": ("sign", "in"),
    "password": ("passcode",),
    "dark": ("theme",),
    "theme": ("dark", "light"),
    "reorder": ("order", "again", "same"),
    "previous": ("past", "history"),
    "past": ("previous", "history"),
    "old": ("previous", "history"),
    "faq": ("question",),
    "contact": ("reach", "representative"),
    "price": ("cost", "pricing"),
    "cost": ("price",),
    "attach": ("attachment", "upload"),
    "upload": ("attach", "attachment"),
    "attachment": ("attach", "file"),
    "diagram": ("schematic",),
    "schematic": ("diagram",),
    "picture": ("photo", "image"),
    "photo": ("image", "picture"),
}

KEEP_WORDS = frozenset(
    {
        "how", "where", "what", "why", "when", "which", "who", "not", "no", "can",
        "on", "off", "out", "in", "up", "again", "more", "down", "all", "same", "you",
    }
)

FILLER_WORDS = frozenset(
    {
        "ok", "okay", "please", "kindly", "just", "also", "actually", "really", "lah",
        "la", "ya", "yeah", "hmm", "um", "uh", "pls", "want", "need", "like", "would",
        "could", "able", "let", "know", "tell", "show", "get", "go", "see", "find",
        "look", "use", "using", "something", "thing", "things", "way",
    }
)

CUES: dict[str, tuple[str, ...]] = {
    "pricing": (
        "price", "prices", "pricing", "cost", "costs", "how much", "in stock", "stock",
        "stocks", "discount", "discounts", "cheaper", "expensive", "ringgit", "rm",
        "lead time", "delivery time", "availability", "available stock", "harga",
    ),
    "human": (
        "speak to", "talk to", "human", "real person", "agent", "sales team", "salesperson",
        "call me", "phone call", "customer service", "contact support", "whatsapp",
        "contact boilermech", "contact you", "contact your", "someone from",
    ),
    "request_status": (
        "status", "been approved", "been closed", "any update", "track my", "tracking",
        "replies", "reply to my request", "response time",
    ),
    "capabilities": ("what can you do", "who are you", "are you a bot", "how can you help", "help me with"),
    "greeting": ("hello", "hi", "hey", "good morning", "good afternoon", "good evening", "salam", "assalamualaikum"),
    "thanks": ("thank", "thanks", "thank you", "terima kasih", "cheers", "appreciate"),
    "goodbye": ("bye", "goodbye", "see you", "see ya"),
    "current_page": ("where am i", "this page", "this screen", "page am i on"),
    "nav:theme": ("dark mode", "light mode", "night mode", "theme", "too bright", "darker", "brighter"),
    "nav:signout": ("log out", "logout", "sign out", "signed out", "logged out", "session expired", "stay signed in"),
    "nav:notifications": ("notification", "notifications", "bell"),
    "nav:policy": ("privacy", "terms and conditions", "terms of use", "personal data", "data protection"),
    "nav:password": ("password",),
    "nav:faq": ("faq", "frequently asked"),
    "nav:cart": ("cart", "basket", "checkout", "check out"),
    "nav:history": ("history", "previous request", "previous requests", "past request", "past requests", "earlier request", "earlier quotation", "request again"),
    "nav:profile": ("profile", "phone number", "phone no", "my address", "company name", "company address", "my details", "personal details"),
    "nav:settings": ("settings", "maintenance mode", "invite", "new user", "add user", "manage user", "user account", "customer account", "announcement", "edit the faq", "chatbot limit"),
    "nav:analytics": ("analytics", "audit", "audit log", "email log", "logged in", "user activity", "user activities", "report", "reports"),
    "nav:enquiries": ("enquiry", "enquiries"),
    "nav:requests": ("customer request", "customer requests", "pending request", "pending requests", "awaiting review", "waiting for review"),
    "nav:dashboard": ("dashboard", "telemetry", "alert", "alerts", "vibration", "log sheet", "logsheet", "daily log", "inspection", "maintenance schedule", "readings", "indicator", "indicators", "trend", "trends"),
    "nav:parts": ("schematic", "parts catalogue", "spare parts", "parts list", "part number"),
    "nav:home": ("home", "home page", "homepage", "main page"),
}

SMALL_TALK: dict[str, str] = {
    "greeting": (
        "Hi! I can help you find your way around BME e-Serve, answer questions about how the "
        "app works, and look up spare parts. What do you need?"
    ),
    "thanks": "You're welcome! Anything else I can help with?",
    "goodbye": "Goodbye! Open the chat any time you need a hand.",
}

PRICING_ANSWER = (
    "I can't confirm prices, stock or delivery times. These are confirmed by our team on a "
    "quotation: add the parts to your [Cart](/app/quotes) and submit a request, and the team "
    "will reply with a confirmed quotation."
)