import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Disc3,
  FileAudio,
  ImageUp,
  Loader2,
  Music2,
  Plus,
  Save,
  Send,
  ShieldAlert,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import WaveformPlayer from "../../components/audio/WaveformPlayer";
import Toast from "../../components/ui/Toast";
import { releaseService } from "../../services/releaseService";
import "./Releases.css";

const releaseTypes = ["Single", "EP", "Album"];
const genres = ["Pop", "Hip-Hop", "Electronic", "Rock", "Folk", "Classical", "Devotional", "Regional", "Other"];
const languages = ["Hindi", "English", "Assamese", "Bengali", "Tamil", "Telugu", "Punjabi", "Instrumental", "Other"];

const initialRelease = {
  release_type: "single",
  title: "",
  primary_artist: "",
  featured_artists: "",
  label_name: "",
  sub_label_name: "",
  genre: "",
  sub_genre: "",
  language: "",
  original_release_date: "",
  release_date: "",
  go_live_date: "",
  upc: "",
  copyright_owner: "",
  copyright_line: "",
  production_year: "",
  catalog_number: "",
  publisher: "",
  territory_mode: "worldwide",
  distribution_type: "standard",
  promotional_release: false,
  explicit: false,
  notes: "",
};

const initialTrack = {
  track_title: "",
  isrc: "",
  iswc: "",
  composer: "",
  lyricist: "",
  producer: "",
  featuring_artist: "",
  remixer: "",
  subgenre: "",
  mood: "",
  duration: "",
  version: "",
  track_language: "",
  track_explicit: false,
  instrumental: false,
  dolby_atmos: false,
  preview_start_time: "",
};

const createLocalId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

const createTrack = (overrides = {}) => ({
  localId: createLocalId(),
  ...initialTrack,
  audio: null,
  audioPreview: "",
  ...overrides,
});

const validateArtworkFile = (artwork) => {
  const errors = [];

  if (!artwork) {
    errors.push("Artwork is required.");
    return errors;
  }

  const artworkTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!artworkTypes.includes(artwork.type)) {
    errors.push("Artwork must be JPG, PNG, or WebP.");
  }

  if (artwork.size > 15 * 1024 * 1024) {
    errors.push("Artwork must be smaller than 15 MB.");
  }

  return errors;
};

const validateAudioFile = (audio, trackNumber) => {
  const errors = [];

  if (!audio) {
    errors.push(`Track ${trackNumber} audio file is required.`);
    return errors;
  }

  const audioTypes = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave"];
  const audioName = audio.name.toLowerCase();

  if (!audioTypes.includes(audio.type) && !audioName.endsWith(".mp3") && !audioName.endsWith(".wav")) {
    errors.push(`Track ${trackNumber} audio must be MP3 or WAV.`);
  }

  if (audio.size > 100 * 1024 * 1024) {
    errors.push(`Track ${trackNumber} audio must be smaller than 100 MB.`);
  }

  return errors;
};

const serializeTrack = ({ localId, audio, audioPreview, ...track }) => track;

const SubmitRelease = () => {
  const navigate = useNavigate();
  const [release, setRelease] = useState(initialRelease);
  const [tracks, setTracks] = useState(() => [createTrack()]);
  const [artwork, setArtwork] = useState(null);
  const [artworkPreview, setArtworkPreview] = useState("");
  const [errors, setErrors] = useState([]);
  const [toast, setToast] = useState(null);
  const [loadingAction, setLoadingAction] = useState("");
  const previewRefs = useRef({ artwork: "", audio: {} });

  useEffect(() => {
    const previews = previewRefs.current;

    return () => {
      if (previews.artwork) {
        URL.revokeObjectURL(previews.artwork);
      }

      Object.values(previews.audio).forEach((previewUrl) => {
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }
      });
    };
  }, []);

  useEffect(() => {
    if (release.release_type === "single" && tracks.length > 1) {
      setTracks((current) => current.slice(0, 1));
      setToast({ type: "info", message: "Single releases can contain only one track." });
    }
  }, [release.release_type, tracks.length]);

  const completion = useMemo(() => {
    const releaseFields = Object.entries(release).filter(([key]) => !["featured_artists", "notes", "explicit"].includes(key));
    const trackFields = tracks.flatMap((track) =>
      Object.entries(serializeTrack(track)).filter(([key]) => !["version", "track_explicit"].includes(key))
    );
    const filledReleaseFields = releaseFields.filter(([, value]) => Boolean(value)).length;
    const filledTrackFields = trackFields.filter(([, value]) => Boolean(value)).length;
    const filledAssets = (artwork ? 1 : 0) + tracks.filter((track) => track.audio).length;
    const totalFields = releaseFields.length + trackFields.length + 1 + tracks.length;

    return totalFields ? Math.round(((filledReleaseFields + filledTrackFields + filledAssets) / totalFields) * 100) : 0;
  }, [artwork, release, tracks]);

  const handleReleaseChange = (event) => {
    const { name, value, type, checked } = event.target;
    setRelease((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };

  const handleTrackChange = (index, event) => {
    const { name, value, type, checked } = event.target;
    setTracks((current) =>
      current.map((track, trackIndex) =>
        trackIndex === index ? { ...track, [name]: type === "checkbox" ? checked : value } : track
      )
    );
  };

  const handleArtworkChange = (event) => {
    const file = event.target.files?.[0] || null;

    if (previewRefs.current.artwork) {
      URL.revokeObjectURL(previewRefs.current.artwork);
    }

    const nextPreviewUrl = file ? URL.createObjectURL(file) : "";
    previewRefs.current.artwork = nextPreviewUrl;
    setArtwork(file);
    setArtworkPreview(nextPreviewUrl);
  };

  const handleTrackAudioChange = (index, event) => {
    const file = event.target.files?.[0] || null;

    setTracks((current) =>
      current.map((track, trackIndex) => {
        if (trackIndex !== index) {
          return track;
        }

        const previousUrl = previewRefs.current.audio[track.localId];
        if (previousUrl) {
          URL.revokeObjectURL(previousUrl);
        }

        const nextPreviewUrl = file ? URL.createObjectURL(file) : "";
        previewRefs.current.audio[track.localId] = nextPreviewUrl;

        return { ...track, audio: file, audioPreview: nextPreviewUrl };
      })
    );
  };

  const clearArtwork = () => {
    if (previewRefs.current.artwork) {
      URL.revokeObjectURL(previewRefs.current.artwork);
    }

    previewRefs.current.artwork = "";
    setArtwork(null);
    setArtworkPreview("");
  };

  const clearTrackAudio = (index) => {
    setTracks((current) =>
      current.map((track, trackIndex) => {
        if (trackIndex !== index) {
          return track;
        }

        const previousUrl = previewRefs.current.audio[track.localId];
        if (previousUrl) {
          URL.revokeObjectURL(previousUrl);
        }

        previewRefs.current.audio[track.localId] = "";
        return { ...track, audio: null, audioPreview: "" };
      })
    );
  };

  const addTrack = () => {
    if (release.release_type === "single") {
      setToast({ type: "error", message: "Switch to EP or Album to add multiple songs." });
      return;
    }

    setTracks((current) => [
      ...current,
      createTrack({
        track_language: release.language,
      }),
    ]);
  };

  const removeTrack = (index) => {
    setTracks((current) => {
      if (current.length === 1) {
        return current;
      }

      const track = current[index];
      const previousUrl = previewRefs.current.audio[track.localId];
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
      }
      delete previewRefs.current.audio[track.localId];

      return current.filter((_, trackIndex) => trackIndex !== index);
    });
  };

  const buildFormData = (status) => {
    const formData = new FormData();
    const uploadedAudioIndexes = [];

    Object.entries({ ...release, status }).forEach(([key, value]) => {
      formData.append(key, value);
    });

    formData.append("tracks", JSON.stringify(tracks.map(serializeTrack)));

    if (artwork) {
      formData.append("artwork", artwork);
    }

    tracks.forEach((track, index) => {
      if (track.audio) {
        formData.append("audio", track.audio);
        uploadedAudioIndexes.push(index);
      }
    });

    formData.append("audio_indexes", JSON.stringify(uploadedAudioIndexes));

    return formData;
  };

  const validateForm = (status) => {
    const nextErrors = [];

    if (!release.title.trim()) nextErrors.push("Release title is required.");
    if (!release.primary_artist.trim()) nextErrors.push("Primary artist is required.");
    if (!release.label_name.trim()) nextErrors.push("Label is required.");
    if (!release.genre.trim()) nextErrors.push("Genre is required.");
    if (!release.language.trim()) nextErrors.push("Release language is required.");
    if (!release.release_date) nextErrors.push("Release date is required.");

    tracks.forEach((track, index) => {
      if (!track.track_title.trim()) nextErrors.push(`Track ${index + 1} title is required.`);
    });

    const duplicateIsrcs = tracks
      .map((track) => track.isrc.trim().toUpperCase())
      .filter(Boolean)
      .filter((isrc, index, values) => values.indexOf(isrc) !== index);

    if (duplicateIsrcs.length) {
      nextErrors.push("Each track must have a unique ISRC.");
    }

    if (status !== "draft") {
      nextErrors.push(...validateArtworkFile(artwork));
      tracks.forEach((track, index) => {
        nextErrors.push(...validateAudioFile(track.audio, index + 1));
      });
    } else {
      if (artwork) {
        nextErrors.push(...validateArtworkFile(artwork).filter((message) => !message.includes("required")));
      }

      tracks.forEach((track, index) => {
        if (track.audio) {
          nextErrors.push(...validateAudioFile(track.audio, index + 1).filter((message) => !message.includes("required")));
        }
      });
    }

    setErrors(nextErrors);
    return nextErrors.length === 0;
  };

  const handleSubmit = async (status) => {
    if (!validateForm(status)) {
      setToast({ type: "error", message: "Please fix the highlighted release fields." });
      return;
    }

    try {
      setLoadingAction(status);
      const data = await releaseService.create(buildFormData(status));
      setToast({ type: "success", message: data.message || "Release saved." });
      navigate(`/releases/${data.release.id}`);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Release submission failed." });
      setErrors(error.response?.data?.errors || []);
    } finally {
      setLoadingAction("");
    }
  };

  return (
    <div className="page-stack release-workspace">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <section className="admin-hero release-hero">
        <div>
          <p className="eyebrow">Release Management</p>
          <h2>Submit a distribution-ready release.</h2>
          <p>Capture album metadata, multi-song track credits, artwork and waveform-ready audio in one Nixa workflow.</p>
        </div>
        <div className="release-progress">
          <strong>{completion}%</strong>
          <span>Metadata complete</span>
        </div>
      </section>

      {errors.length > 0 && (
        <section className="validation-panel">
          <ShieldAlert size={18} />
          <div>
            <strong>Validation needed</strong>
            {errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        </section>
      )}

      <section className="release-form-grid">
        <form className="release-form-card" onSubmit={(event) => event.preventDefault()}>
          <div className="form-section-heading">
            <Disc3 size={18} />
            <div>
              <h3>Release Metadata</h3>
              <p>Core catalog information used for stores and accounting.</p>
            </div>
          </div>

          <div className="segmented-control">
            {releaseTypes.map((type) => (
              <button
                className={release.release_type === type.toLowerCase() ? "active" : ""}
                key={type}
                type="button"
                onClick={() => setRelease((current) => ({ ...current, release_type: type.toLowerCase() }))}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="form-grid two-columns">
            <label>
              <span>Release Title</span>
              <input name="title" value={release.title} onChange={handleReleaseChange} placeholder="Midnight Pulse" />
            </label>
            <label>
              <span>Primary Artist</span>
              <input name="primary_artist" value={release.primary_artist} onChange={handleReleaseChange} placeholder="Nixa Collective" />
            </label>
            <label>
              <span>Featured Artists</span>
              <input name="featured_artists" value={release.featured_artists} onChange={handleReleaseChange} placeholder="Optional collaborators" />
            </label>
            <label>
              <span>Label</span>
              <input name="label_name" value={release.label_name} onChange={handleReleaseChange} placeholder="Nixa Music" />
            </label>
            <label>
              <span>Genre</span>
              <select name="genre" value={release.genre} onChange={handleReleaseChange}>
                <option value="">Select genre</option>
                {genres.map((genre) => (
                  <option key={genre} value={genre}>
                    {genre}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Sub-genre</span>
              <input name="sub_genre" value={release.sub_genre} onChange={handleReleaseChange} placeholder="Synth pop, Indie folk" />
            </label>
            <label>
              <span>Language</span>
              <select name="language" value={release.language} onChange={handleReleaseChange}>
                <option value="">Select language</option>
                {languages.map((language) => (
                  <option key={language} value={language}>
                    {language}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Release Date</span>
              <div className="input-with-icon">
                <Calendar size={16} />
                <input type="date" name="release_date" value={release.release_date} onChange={handleReleaseChange} />
              </div>
            </label>
            <label>
              <span>UPC</span>
              <input name="upc" value={release.upc} onChange={handleReleaseChange} placeholder="Optional if not assigned" />
            </label>
            <label>
              <span>Original Release Date</span>
              <input type="date" name="original_release_date" value={release.original_release_date} onChange={handleReleaseChange} />
            </label>
            <label>
              <span>Go Live Date</span>
              <input type="date" name="go_live_date" value={release.go_live_date} onChange={handleReleaseChange} />
            </label>
            <label>
              <span>Sub Label</span>
              <input name="sub_label_name" value={release.sub_label_name} onChange={handleReleaseChange} placeholder="Optional imprint" />
            </label>
            <label>
              <span>Catalog Number</span>
              <input name="catalog_number" value={release.catalog_number} onChange={handleReleaseChange} placeholder="NIXA-2026-001" />
            </label>
            <label>
              <span>Copyright Owner</span>
              <input name="copyright_owner" value={release.copyright_owner} onChange={handleReleaseChange} placeholder="Copyright owner" />
            </label>
            <label>
              <span>Copyright Line</span>
              <input name="copyright_line" value={release.copyright_line} onChange={handleReleaseChange} placeholder="(C) 2026 Nixa Music" />
            </label>
            <label>
              <span>Production Year</span>
              <input name="production_year" value={release.production_year} onChange={handleReleaseChange} placeholder="2026" />
            </label>
            <label>
              <span>Publisher</span>
              <input name="publisher" value={release.publisher} onChange={handleReleaseChange} placeholder="Publisher name" />
            </label>
            <label>
              <span>Territories</span>
              <select name="territory_mode" value={release.territory_mode} onChange={handleReleaseChange}>
                <option value="worldwide">Worldwide</option>
                <option value="include">Include specific territories</option>
                <option value="exclude">Exclude specific territories</option>
              </select>
            </label>
            <label>
              <span>Distribution</span>
              <select name="distribution_type" value={release.distribution_type} onChange={handleReleaseChange}>
                <option value="standard">Standard</option>
                <option value="priority">Priority</option>
                <option value="takedown">Takedown</option>
                <option value="update">Metadata update</option>
              </select>
            </label>
            <label className="toggle-row">
              <input type="checkbox" name="explicit" checked={release.explicit} onChange={handleReleaseChange} />
              <span>Explicit release</span>
            </label>
            <label className="toggle-row">
              <input type="checkbox" name="promotional_release" checked={release.promotional_release} onChange={handleReleaseChange} />
              <span>Promotional release</span>
            </label>
          </div>

          <label>
            <span>Release Notes</span>
            <textarea name="notes" value={release.notes} onChange={handleReleaseChange} placeholder="Delivery notes, store instructions, marketing context" rows={4} />
          </label>

          <div className="track-section-heading">
            <div className="form-section-heading">
              <Music2 size={18} />
              <div>
                <h3>Track Metadata</h3>
                <p>Singles stay to one song; EPs and albums can carry multiple tracks with auto ISRC generation.</p>
              </div>
            </div>
            <button className="secondary-button compact-button" type="button" disabled={release.release_type === "single"} onClick={addTrack}>
              <Plus size={16} />
              Add Song
            </button>
          </div>

          <div className="track-editor-list">
            {tracks.map((track, index) => (
              <section className="track-editor-card" key={track.localId}>
                <div className="track-editor-heading">
                  <div>
                    <span>Song {index + 1}</span>
                    <strong>{track.track_title || "Untitled track"}</strong>
                  </div>
                  <button
                    className="danger-icon-button"
                    type="button"
                    disabled={tracks.length === 1}
                    onClick={() => removeTrack(index)}
                    aria-label={`Remove song ${index + 1}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="form-grid two-columns">
                  <label>
                    <span>Track Title</span>
                    <input name="track_title" value={track.track_title} onChange={(event) => handleTrackChange(index, event)} placeholder="Track title" />
                  </label>
                  <label>
                    <span>ISRC</span>
                    <input name="isrc" value={track.isrc} onChange={(event) => handleTrackChange(index, event)} placeholder="Auto generated on submit" />
                  </label>
                  <label>
                    <span>ISWC</span>
                    <input name="iswc" value={track.iswc} onChange={(event) => handleTrackChange(index, event)} placeholder="Optional publishing code" />
                  </label>
                  <label>
                    <span>Featuring</span>
                    <input name="featuring_artist" value={track.featuring_artist} onChange={(event) => handleTrackChange(index, event)} placeholder="Featured artist" />
                  </label>
                  <label>
                    <span>Remixer</span>
                    <input name="remixer" value={track.remixer} onChange={(event) => handleTrackChange(index, event)} placeholder="Remixer" />
                  </label>
                  <label>
                    <span>Composer</span>
                    <input name="composer" value={track.composer} onChange={(event) => handleTrackChange(index, event)} placeholder="Composer name" />
                  </label>
                  <label>
                    <span>Lyricist</span>
                    <input name="lyricist" value={track.lyricist} onChange={(event) => handleTrackChange(index, event)} placeholder="Lyricist name" />
                  </label>
                  <label>
                    <span>Producer</span>
                    <input name="producer" value={track.producer} onChange={(event) => handleTrackChange(index, event)} placeholder="Producer name" />
                  </label>
                  <label>
                    <span>Duration</span>
                    <input name="duration" value={track.duration} onChange={(event) => handleTrackChange(index, event)} placeholder="03:42" />
                  </label>
                  <label>
                    <span>Track Version</span>
                    <input name="version" value={track.version} onChange={(event) => handleTrackChange(index, event)} placeholder="Original, Radio Edit" />
                  </label>
                  <label>
                    <span>Track Language</span>
                    <select name="track_language" value={track.track_language} onChange={(event) => handleTrackChange(index, event)}>
                      <option value="">Select language</option>
                      {languages.map((language) => (
                        <option key={language} value={language}>
                          {language}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="toggle-row">
                    <input type="checkbox" name="track_explicit" checked={track.track_explicit} onChange={(event) => handleTrackChange(index, event)} />
                    <span>Explicit track</span>
                  </label>
                </div>

                <div className="track-audio-block">
                  <label className="track-audio-drop">
                    <FileAudio size={22} />
                    <strong>{track.audio?.name || `Upload audio for song ${index + 1}`}</strong>
                    <span>MP3 or WAV under 100 MB</span>
                    <input type="file" accept="audio/mpeg,audio/wav,.mp3,.wav" onChange={(event) => handleTrackAudioChange(index, event)} />
                  </label>
                  {track.audioPreview && (
                    <div className="audio-preview waveform-preview">
                      <WaveformPlayer src={track.audioPreview} title={`${track.track_title || `Song ${index + 1}`} waveform`} />
                      <button className="secondary-button compact-button" type="button" onClick={() => clearTrackAudio(index)}>
                        <X size={15} />
                        Remove Audio
                      </button>
                    </div>
                  )}
                </div>
              </section>
            ))}
          </div>
        </form>

        <aside className="upload-panel">
          <div className="form-section-heading">
            <UploadCloud size={18} />
            <div>
              <h3>Assets</h3>
              <p>Album artwork and final submission controls.</p>
            </div>
          </div>

          <label className={artworkPreview ? "upload-drop has-preview" : "upload-drop"}>
            {artworkPreview ? (
              <>
                <img src={artworkPreview} alt="Artwork preview" />
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    clearArtwork();
                  }}
                >
                  <X size={16} />
                </button>
              </>
            ) : (
              <>
                <ImageUp size={28} />
                <strong>Upload artwork</strong>
                <span>JPG, PNG, or WebP under 15 MB</span>
              </>
            )}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleArtworkChange} />
          </label>

          <div className="asset-summary-card">
            <span>Release package</span>
            <strong>{tracks.length} song{tracks.length === 1 ? "" : "s"}</strong>
            <p>{tracks.filter((track) => track.audio).length} audio file{tracks.filter((track) => track.audio).length === 1 ? "" : "s"} attached</p>
          </div>

          <div className="submit-actions">
            <button className="secondary-button" type="button" disabled={Boolean(loadingAction)} onClick={() => handleSubmit("draft")}>
              {loadingAction === "draft" ? <Loader2 className="spin" size={17} /> : <Save size={17} />}
              Save Draft
            </button>
            <button className="primary-button" type="button" disabled={Boolean(loadingAction)} onClick={() => handleSubmit("submitted")}>
              {loadingAction === "submitted" ? <Loader2 className="spin" size={17} /> : <Send size={17} />}
              Submit Release
            </button>
          </div>
        </aside>
      </section>
    </div>
  );
};

export default SubmitRelease;
