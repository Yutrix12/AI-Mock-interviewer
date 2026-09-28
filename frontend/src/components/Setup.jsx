import { useState } from 'react'
import { ArrowRightIcon, PlusIcon, XIcon } from '@phosphor-icons/react'
import { api } from '../lib/api'
import { CATEGORY_TITLES, DIFFICULTIES, LENGTH_OPTIONS } from '../lib/config'

const SENIORITY_LABEL = { entry: 'Entry level', mid: 'Mid level', senior: 'Senior level' }

function ProfilePanel({ profile, aiParsed, onSkillsChange, pending, skillError, onReplaceResume }) {
  const [newSkill, setNewSkill] = useState('')

  const grouped = profile.skills.reduce((acc, skill) => {
    ;(acc[skill.category] ??= []).push(skill)
    return acc
  }, {})
  const categories = Object.keys(CATEGORY_TITLES).filter((c) => grouped[c]?.length)

  const addSkill = (event) => {
    event.preventDefault()
    const name = newSkill.trim()
    if (!name) return
    if (!profile.skills.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      onSkillsChange([...profile.skills, { name, category: 'other' }])
    }
    setNewSkill('')
  }

  const years = profile.years_experience
  const meta = [
    SENIORITY_LABEL[profile.seniority],
    years ? `${years} ${years === 1 ? 'year' : 'years'} experience` : null,
  ].filter(Boolean)

  return (
    <aside className="profile panel bezel" aria-labelledby="profile-name">
      <h2 id="profile-name" className="profile-name">
        {profile.name || 'Your profile'}
      </h2>
      {profile.headline && <p className="profile-headline">{profile.headline}</p>}
      <p className="profile-meta">{meta.join(', ')}</p>

      {!aiParsed && (
        <p className="profile-note">
          The local model wasn’t reachable, so skills were found by keyword matching. Check them before you start.
        </p>
      )}

      <div className="profile-section">
        <h3 className="profile-section-title">Skills</h3>
        {categories.length === 0 && <p className="profile-empty">No skills found yet. Add a few below.</p>}
        {categories.map((category) => (
          <div key={category} className="skill-group">
            <p className="skill-group-title">{CATEGORY_TITLES[category]}</p>
            <ul className="chips">
              {grouped[category].map((skill) => (
                <li key={skill.name} className="chip">
                  <span translate="no">{skill.name}</span>
                  <button
                    type="button"
                    className="chip-remove"
                    aria-label={`Remove ${skill.name}`}
                    disabled={pending}
                    onClick={() => onSkillsChange(profile.skills.filter((s) => s.name !== skill.name))}
                  >
                    <XIcon aria-hidden="true" weight="bold" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <form className="add-skill" onSubmit={addSkill}>
          <label className="field-label" htmlFor="add-skill">
            Add a skill
          </label>
          <div className="add-skill-row">
            <input
              id="add-skill"
              name="skill"
              type="text"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              placeholder="e.g. Kubernetes…"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" className="btn btn-secondary" disabled={pending || !newSkill.trim()}>
              <PlusIcon aria-hidden="true" weight="bold" />
              <span>Add</span>
            </button>
          </div>
          {skillError && (
            <p className="field-error" role="alert">
              {skillError}
            </p>
          )}
        </form>
      </div>

      {(profile.experience.length > 0 || profile.projects.length > 0) && (
        <div className="profile-section">
          <h3 className="profile-section-title">Found on your resume</h3>
          <ul className="found-list">
            {profile.experience.map((job) => (
              <li key={`${job.title}-${job.organization}`}>
                <strong>{job.title}</strong>
                {job.organization && <span>, {job.organization}</span>}
              </li>
            ))}
            {profile.projects.map((project) => (
              <li key={project.name}>
                <strong translate="no">{project.name}</strong>
                <span> project</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button type="button" className="link-wipe profile-replace" onClick={onReplaceResume}>
        <span>Upload a different resume</span>
      </button>
    </aside>
  )
}

export default function Setup({ profile, tracks, aiParsed, selection, onSelectionChange, onProfileChange, onStart, onReplaceResume }) {
  const [pending, setPending] = useState(false)
  const [skillError, setSkillError] = useState(null)
  const selectedTrack = tracks.find((t) => t.id === selection.trackId) ?? tracks[0]

  const updateSkills = async (skills) => {
    setPending(true)
    setSkillError(null)
    try {
      const data = await api.tracks({ ...profile, skills })
      onProfileChange(data.profile ?? { ...profile, skills }, data.tracks)
    } catch (err) {
      setSkillError(err.message)
    } finally {
      setPending(false)
    }
  }

  const set = (patch) => onSelectionChange({ ...selection, ...patch })

  return (
    <div className="setup">
      <section className="setup-main" aria-labelledby="setup-title">
        <span className="eyebrow">/ Choose</span>
        <h1 id="setup-title" className="page-title">
          Choose your <em>interview</em>.
        </h1>
        <p className="page-sub">These options come from the skills on your resume. Edit your skills to change them.</p>

        <form
          className="setup-form"
          onSubmit={(e) => {
            e.preventDefault()
            onStart(selection)
          }}
        >
          <fieldset className="track-options" aria-busy={pending || undefined}>
            <legend className="visually-hidden">Interview type</legend>
            {tracks.map((track) => (
              <label key={track.id} className="track-option" data-selected={track.id === selectedTrack.id || undefined}>
                <input
                  type="radio"
                  name="track"
                  value={track.id}
                  checked={track.id === selectedTrack.id}
                  onChange={() => set({ trackId: track.id })}
                  className="visually-hidden"
                />
                <span className="track-head">
                  <span className="track-title">{track.title}</span>
                  {track.recommended && <span className="track-flag">Recommended</span>}
                </span>
                <span className="track-desc">{track.description}</span>
                {track.focus_skills.length > 0 && (
                  <span className="track-skills" translate="no">
                    {track.focus_skills.join(', ')}
                  </span>
                )}
              </label>
            ))}
          </fieldset>

          <div className="setup-options">
            <fieldset className="segmented-field">
              <legend className="field-label">Difficulty</legend>
              <div className="segmented">
                {DIFFICULTIES.map((d) => (
                  <label key={d.id} className="segment" title={d.hint}>
                    <input
                      type="radio"
                      name="difficulty"
                      value={d.id}
                      checked={selection.difficulty === d.id}
                      onChange={() => set({ difficulty: d.id })}
                      className="visually-hidden"
                    />
                    <span>{d.label}</span>
                  </label>
                ))}
              </div>
              <p className="field-hint">{DIFFICULTIES.find((d) => d.id === selection.difficulty)?.hint}</p>
            </fieldset>

            <fieldset className="segmented-field">
              <legend className="field-label">Length</legend>
              <div className="segmented">
                {LENGTH_OPTIONS.map((n) => (
                  <label key={n} className="segment">
                    <input
                      type="radio"
                      name="count"
                      value={n}
                      checked={selection.count === n}
                      onChange={() => set({ count: n })}
                      className="visually-hidden"
                    />
                    <span>{n} questions</span>
                  </label>
                ))}
              </div>
              <p className="field-hint">About {selection.count * 3} minutes</p>
            </fieldset>
          </div>

          <div className="setup-actions">
            <button type="submit" className="btn btn-primary btn-lg btn-has-icon" disabled={pending}>
              <span>Start interview</span>
              <span className="btn-icon" aria-hidden="true">
                <ArrowRightIcon weight="bold" />
              </span>
            </button>
          </div>
        </form>
      </section>

      <ProfilePanel
        profile={profile}
        aiParsed={aiParsed}
        pending={pending}
        skillError={skillError}
        onSkillsChange={updateSkills}
        onReplaceResume={onReplaceResume}
      />
    </div>
  )
}
