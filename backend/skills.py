"""Skill taxonomy: canonical names, aliases and categories.

Used to (a) normalise and categorise the skills the LLM extracts, and
(b) find skills with plain keyword matching when the LLM is unavailable.
"""

import re

CATEGORY_TITLES = {
    "frontend": "Frontend engineering",
    "backend": "Backend engineering",
    "databases": "Databases & SQL",
    "cloud": "Cloud & DevOps",
    "ml": "Machine learning & AI",
    "data": "Data engineering & analytics",
    "mobile": "Mobile development",
    "languages": "Programming fundamentals",
    "other": "Other",
}

# canonical name -> (category, aliases). Aliases are matched case-insensitively.
TAXONOMY: dict[str, tuple[str, list[str]]] = {
    # Frontend
    "React": ("frontend", ["react.js", "reactjs"]),
    "Next.js": ("frontend", ["nextjs", "next js"]),
    "Vue": ("frontend", ["vue.js", "vuejs"]),
    "Angular": ("frontend", ["angularjs"]),
    "Svelte": ("frontend", ["sveltekit"]),
    "JavaScript": ("frontend", ["js", "es6", "ecmascript"]),
    "TypeScript": ("frontend", ["ts"]),
    "HTML": ("frontend", ["html5"]),
    "CSS": ("frontend", ["css3", "sass", "scss"]),
    "Tailwind CSS": ("frontend", ["tailwind", "tailwindcss"]),
    "Redux": ("frontend", ["redux toolkit"]),
    "Vite": ("frontend", []),
    "Webpack": ("frontend", []),
    # Backend
    "Node.js": ("backend", ["node", "nodejs"]),
    "Express": ("backend", ["express.js", "expressjs"]),
    "Django": ("backend", []),
    "Flask": ("backend", []),
    "FastAPI": ("backend", []),
    "Spring Boot": ("backend", ["spring", "springboot"]),
    ".NET": ("backend", ["asp.net", "dotnet", ".net core"]),
    "Ruby on Rails": ("backend", ["rails"]),
    "Laravel": ("backend", []),
    "GraphQL": ("backend", []),
    "REST APIs": ("backend", ["rest", "restful", "rest api", "restful apis"]),
    "gRPC": ("backend", []),
    "Microservices": ("backend", ["microservice architecture"]),
    # Databases
    "SQL": ("databases", []),
    "PostgreSQL": ("databases", ["postgres"]),
    "MySQL": ("databases", []),
    "MongoDB": ("databases", ["mongo"]),
    "Redis": ("databases", []),
    "SQLite": ("databases", []),
    "DynamoDB": ("databases", []),
    "Firebase": ("databases", ["firestore"]),
    "Elasticsearch": ("databases", ["elastic search"]),
    # Cloud & DevOps
    "AWS": ("cloud", ["amazon web services", "ec2", "s3", "lambda"]),
    "Google Cloud": ("cloud", ["gcp", "google cloud platform"]),
    "Azure": ("cloud", ["microsoft azure"]),
    "Docker": ("cloud", ["containers"]),
    "Kubernetes": ("cloud", ["k8s"]),
    "Terraform": ("cloud", []),
    "CI/CD": ("cloud", ["ci cd", "continuous integration"]),
    "GitHub Actions": ("cloud", []),
    "Jenkins": ("cloud", []),
    "Linux": ("cloud", ["unix", "bash"]),
    "Nginx": ("cloud", []),
    # Machine learning & AI
    "Machine Learning": ("ml", ["ml"]),
    "Deep Learning": ("ml", ["dl", "neural networks"]),
    "PyTorch": ("ml", ["torch"]),
    "TensorFlow": ("ml", ["tf"]),
    "Keras": ("ml", []),
    "scikit-learn": ("ml", ["sklearn", "scikit learn"]),
    "Hugging Face": ("ml", ["huggingface", "transformers"]),
    "LLMs": ("ml", ["llm", "large language models", "generative ai", "genai"]),
    "NLP": ("ml", ["natural language processing"]),
    "Computer Vision": ("ml", ["cv", "opencv"]),
    "LangChain": ("ml", []),
    "RAG": ("ml", ["retrieval augmented generation"]),
    # Data
    "Pandas": ("data", []),
    "NumPy": ("data", ["numpy"]),
    "Apache Spark": ("data", ["spark", "pyspark"]),
    "Kafka": ("data", ["apache kafka"]),
    "Airflow": ("data", ["apache airflow"]),
    "dbt": ("data", []),
    "Snowflake": ("data", []),
    "BigQuery": ("data", []),
    "Tableau": ("data", []),
    "Power BI": ("data", ["powerbi"]),
    "Data Analysis": ("data", ["data analytics", "analytics"]),
    # Mobile
    "React Native": ("mobile", []),
    "Flutter": ("mobile", ["dart"]),
    "Swift": ("mobile", ["swiftui"]),
    "Kotlin": ("mobile", ["jetpack compose"]),
    "Android": ("mobile", []),
    "iOS": ("mobile", []),
    # Languages & fundamentals
    "Python": ("languages", []),
    "Java": ("languages", []),
    "C++": ("languages", ["cpp"]),
    "C": ("languages", []),
    "C#": ("languages", ["csharp", "c sharp"]),
    "Go": ("languages", ["golang"]),
    "Rust": ("languages", []),
    "Ruby": ("languages", []),
    "PHP": ("languages", []),
    "Scala": ("languages", []),
    "Data Structures & Algorithms": ("languages", ["dsa", "data structures", "algorithms"]),
    "Object-Oriented Programming": ("languages", ["oop", "object oriented programming"]),
    "System Design": ("languages", ["distributed systems"]),
    # Other
    "Git": ("other", ["github", "gitlab"]),
    "Agile": ("other", ["scrum", "kanban"]),
    "Figma": ("other", []),
}

# Names too ambiguous to find by keyword in free text ("C", "Go", "ts" ...).
# They still work when the LLM lists them explicitly.
_NOT_SCANNABLE = {"C", "Go", "Swift", "Rust", "Ruby", "Scala", "Agile"}
_NOT_SCANNABLE_ALIASES = {"js", "ts", "tf", "cv", "dl", "ml", "rest", "node", "spring", "analytics", "containers", "torch"}

_LOOKUP: dict[str, str] = {}
for _canonical, (_category, _aliases) in TAXONOMY.items():
    _LOOKUP[_canonical.lower()] = _canonical
    for _alias in _aliases:
        _LOOKUP[_alias.lower()] = _canonical


def canonical_name(raw: str) -> str:
    """Map an alias or differently-cased name to its canonical form.

    "AWS (EC2, S3, Lambda)" -> "AWS": a trailing parenthetical is dropped when
    the remaining name is a known skill.
    """
    cleaned = " ".join(raw.strip().split())
    if cleaned.lower() in _LOOKUP:
        return _LOOKUP[cleaned.lower()]
    base = re.sub(r"\s*\(.*\)\s*$", "", cleaned)
    return _LOOKUP.get(base.lower(), cleaned)


def category_of(name: str) -> str:
    entry = TAXONOMY.get(canonical_name(name))
    return entry[0] if entry else "other"


def _pattern(term: str) -> re.Pattern:
    # Word-ish boundaries that still allow symbols like "C++", ".NET", "Node.js".
    return re.compile(rf"(?<![\w+#.]){re.escape(term)}(?![\w+#])", re.IGNORECASE)


_SCAN_TERMS: list[tuple[re.Pattern, str]] = []
for _canonical, (_category, _aliases) in TAXONOMY.items():
    if _canonical in _NOT_SCANNABLE:
        continue
    for _term in [_canonical, *_aliases]:
        if _term.lower() in _NOT_SCANNABLE_ALIASES:
            continue
        _SCAN_TERMS.append((_pattern(_term), _canonical))


def scan_text(text: str) -> list[str]:
    """Canonical skills mentioned in `text`, in order of first appearance."""
    hits: list[tuple[int, str]] = []
    seen: set[str] = set()
    for pattern, canonical in _SCAN_TERMS:
        match = pattern.search(text)
        if match and canonical not in seen:
            seen.add(canonical)
            hits.append((match.start(), canonical))
    return [name for _, name in sorted(hits)]
