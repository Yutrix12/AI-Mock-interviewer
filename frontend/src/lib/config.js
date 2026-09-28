export const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:5000'

// Seconds a spoken answer can run before recording stops on its own.
export const ANSWER_LIMIT_SECONDS = 120

export const MAX_RESUME_MB = 5
export const RESUME_EXTENSIONS = ['.pdf', '.docx', '.txt']

export const LENGTH_OPTIONS = [3, 5, 8]

export const DIFFICULTIES = [
  { id: 'entry', label: 'Entry', hint: 'Fundamentals and your own work' },
  { id: 'mid', label: 'Mid', hint: 'Trade-offs and debugging' },
  { id: 'senior', label: 'Senior', hint: 'Architecture, scale and leadership' },
]

export const CATEGORY_TITLES = {
  frontend: 'Frontend',
  backend: 'Backend',
  databases: 'Databases',
  cloud: 'Cloud & DevOps',
  ml: 'Machine learning',
  data: 'Data',
  mobile: 'Mobile',
  languages: 'Languages & CS',
  other: 'Other',
}

export const QUESTION_TYPE_LABELS = {
  technical: 'Technical question',
  project: 'Project question',
  behavioral: 'Behavioral question',
}

export const DIMENSIONS = [
  { id: 'content', label: 'Content' },
  { id: 'clarity', label: 'Clarity' },
  { id: 'structure', label: 'Structure' },
  { id: 'relevance', label: 'Relevance' },
]
