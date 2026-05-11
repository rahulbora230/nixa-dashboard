import React, { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import "./CreateRelease.css";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

const emptyTrack = {
  song_name: "",
  audio_file: null,
  audio_preview: "",
  category: "Original",
  isrc: "",
  singer_name: "",
  is_explicit: false,
  lyricist: "",
  composer: "",
  producer: "",
  director: "",
  star_cast: "",
  description: "",
  language: "",
  genre: "",
  mood: "",
  crbt_title: "",
  crbt_starting_time: "",
};

const CreateRelease = () => {
  const [release, setRelease] = useState({
    album_name: "",
    upc: "",
    content_type: "Album",
    release_date: "",
    go_live_date: "",
    label_name: "",
    sub_label_name: "",
    copyright_holder: "",
    stores: "All Platforms",
    territories: "Worldwide",
    promotion_ready: "No",
    artwork_file: null,
    artwork_preview: "",
  });

  const [tracks, setTracks] = useState([]);
  const [track, setTrack] = useState(emptyTrack);
  const [showSongModal, setShowSongModal] = useState(false);
  const [editIndex, setEditIndex] = useState(null);

  const handleReleaseChange = (e) => {
    const { name, value } = e.target;
    setRelease({ ...release, [name]: value });
  };

  const handleArtwork = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setRelease({
      ...release,
      artwork_file: file,
      artwork_preview: URL.createObjectURL(file),
    });
  };

  const handleTrackChange = (e) => {
    const { name, value, type, checked } = e.target;

    setTrack({
      ...track,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleAudio = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setTrack({
      ...track,
      audio_file: file,
      audio_preview: URL.createObjectURL(file),
    });
  };

  const openAddSongModal = () => {
    setTrack(emptyTrack);
    setEditIndex(null);
    setShowSongModal(true);
  };

  const editTrack = (index) => {
    setTrack(tracks[index]);
    setEditIndex(index);
    setShowSongModal(true);
  };

  const saveTrack = () => {
    if (!track.song_name || !track.audio_file || !track.singer_name) {
      alert("Song name, audio file and singer name required");
      return;
    }

    if (editIndex !== null) {
      const updatedTracks = [...tracks];
      updatedTracks[editIndex] = track;
      setTracks(updatedTracks);
      setEditIndex(null);
    } else {
      setTracks([...tracks, track]);
    }

    setTrack(emptyTrack);
    setShowSongModal(false);
  };

  const removeTrack = (index) => {
    const confirmDelete = window.confirm("Remove this song?");
    if (!confirmDelete) return;

    setTracks(tracks.filter((_, i) => i !== index));
  };

  const closeModal = () => {
    setTrack(emptyTrack);
    setEditIndex(null);
    setShowSongModal(false);
  };

  const submitRelease = async () => {
    if (!release.album_name || !release.artwork_file) {
      alert("Album name and artwork required");
      return;
    }

    if (tracks.length === 0) {
      alert("Please add at least one song");
      return;
    }

    const formData = new FormData();

    formData.append(
      "release",
      JSON.stringify({
        album_name: release.album_name,
        upc: release.upc,
        content_type: release.content_type,
        release_date: release.release_date,
        go_live_date: release.go_live_date,
        label_name: release.label_name,
        sub_label_name: release.sub_label_name,
        copyright_holder: release.copyright_holder,
        stores: release.stores,
        territories: release.territories,
        promotion_ready: release.promotion_ready,
      })
    );

    formData.append("artwork", release.artwork_file);

    tracks.forEach((t, index) => {
      formData.append(`audio_${index}`, t.audio_file);
    });

    const cleanTracks = tracks.map((t, index) => ({
      song_name: t.song_name,
      category: t.category,
      isrc: t.isrc,
      singer_name: t.singer_name,
      is_explicit: t.is_explicit,
      lyricist: t.lyricist,
      composer: t.composer,
      producer: t.producer,
      director: t.director,
      star_cast: t.star_cast,
      description: t.description,
      language: t.language,
      genre: t.genre,
      mood: t.mood,
      crbt_title: t.crbt_title,
      crbt_starting_time: t.crbt_starting_time,
      audio_key: `audio_${index}`,
    }));

    formData.append("tracks", JSON.stringify(cleanTracks));

    try {
      const res = await fetch("http://localhost:5000/api/releases/create", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Submission failed");

      alert("Release submitted successfully");
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="release-page">
      <div className="release-header">
        <div>
          <h1>Create Release / Product</h1>
          <p>Add artwork, metadata and multiple songs with waveform preview.</p>
        </div>

        <button onClick={submitRelease} className="submit-btn">
          Submit Release
        </button>
      </div>

      <div className="release-layout">
        <div className="preview-card">
          <div className="artwork-box">
            {release.artwork_preview ? (
              <img src={release.artwork_preview} alt="Artwork" />
            ) : (
              <span>Artwork Preview</span>
            )}
          </div>

          <label className="upload-label">
            Upload Artwork
            <input type="file" accept="image/*" onChange={handleArtwork} />
          </label>

          <div className="summary-box">
            <p>
              <b>Tracks:</b> {tracks.length}
            </p>
            <p>
              <b>Type:</b> {release.content_type}
            </p>
            <p>
              <b>Stores:</b> {release.stores}
            </p>
          </div>
        </div>

        <div className="form-card">
          <h2>Release Metadata</h2>

          <div className="grid-2">
            <Input
              label="Album / Release Name"
              name="album_name"
              value={release.album_name}
              onChange={handleReleaseChange}
              required
            />

            <Input
              label="UPC"
              name="upc"
              value={release.upc}
              onChange={handleReleaseChange}
            />

            <Select
              label="Content Type"
              name="content_type"
              value={release.content_type}
              onChange={handleReleaseChange}
              options={["Single", "EP", "Album"]}
            />

            <Input
              label="Primary Label Name"
              name="label_name"
              value={release.label_name}
              onChange={handleReleaseChange}
            />

            <Input
              label="Sub Label Name"
              name="sub_label_name"
              value={release.sub_label_name}
              onChange={handleReleaseChange}
            />

            <Input
              label="Copyright Holder"
              name="copyright_holder"
              value={release.copyright_holder}
              onChange={handleReleaseChange}
            />

            <Input
              label="Release Date"
              type="date"
              name="release_date"
              value={release.release_date}
              onChange={handleReleaseChange}
            />

            <Input
              label="Go Live Date"
              type="date"
              name="go_live_date"
              value={release.go_live_date}
              onChange={handleReleaseChange}
            />

            <Select
              label="Stores"
              name="stores"
              value={release.stores}
              onChange={handleReleaseChange}
              options={[
                "All Platforms",
                "Spotify",
                "Apple Music",
                "YouTube Music",
                "JioSaavn",
              ]}
            />

            <Select
              label="Territories"
              name="territories"
              value={release.territories}
              onChange={handleReleaseChange}
              options={["Worldwide", "India Only", "Selected Territories"]}
            />

            <Select
              label="Ready to promote this release?"
              name="promotion_ready"
              value={release.promotion_ready}
              onChange={handleReleaseChange}
              options={["No", "Yes"]}
            />
          </div>

          <div className="track-section">
            <div className="section-head">
              <h2>Tracks / Songs</h2>
              <button onClick={openAddSongModal}>+ Add Song</button>
            </div>

            {tracks.length === 0 ? (
              <div className="empty-track">No songs added yet.</div>
            ) : (
              <div className="track-list">
                {tracks.map((t, index) => (
                  <TrackRow
                    key={index}
                    track={t}
                    index={index}
                    editTrack={editTrack}
                    removeTrack={removeTrack}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showSongModal && (
        <div className="modal-overlay">
          <div className="song-modal">
            <div className="modal-head">
              <h2>{editIndex !== null ? "Edit Song" : "Add Song"}</h2>
              <button onClick={closeModal}>×</button>
            </div>

            <div className="grid-4">
              <Input
                label="Song Name"
                name="song_name"
                value={track.song_name}
                onChange={handleTrackChange}
                required
              />

              <div className="field">
                <label>
                  Audio File <span>*</span>
                </label>
                <input type="file" accept="audio/*" onChange={handleAudio} />
              </div>

              <Select
                label="Category"
                name="category"
                value={track.category}
                onChange={handleTrackChange}
                options={["Original", "Cover", "Remix", "Acoustic", "Live"]}
              />

              <Input
                label="ISRC"
                name="isrc"
                value={track.isrc}
                onChange={handleTrackChange}
              />
            </div>

            {track.audio_preview && (
              <div className="wave-card">
                <WaveformPlayer url={track.audio_preview} />
              </div>
            )}

            <div className="grid-3">
              <Input
                label="Singer(s) Name"
                name="singer_name"
                value={track.singer_name}
                onChange={handleTrackChange}
                required
              />

              <div className="checkbox-field">
                <label>Is Explicit?</label>
                <input
                  type="checkbox"
                  name="is_explicit"
                  checked={track.is_explicit}
                  onChange={handleTrackChange}
                />
              </div>

              <Input
                label="Lyricist"
                name="lyricist"
                value={track.lyricist}
                onChange={handleTrackChange}
              />

              <Input
                label="Composer"
                name="composer"
                value={track.composer}
                onChange={handleTrackChange}
              />

              <Input
                label="Producer"
                name="producer"
                value={track.producer}
                onChange={handleTrackChange}
              />

              <Input
                label="Director"
                name="director"
                value={track.director}
                onChange={handleTrackChange}
              />

              <Input
                label="Star Cast"
                name="star_cast"
                value={track.star_cast}
                onChange={handleTrackChange}
              />

              <Input
                label="Description"
                name="description"
                value={track.description}
                onChange={handleTrackChange}
              />
            </div>

            <hr />

            <div className="grid-3">
              <Select
                label="Language"
                name="language"
                value={track.language}
                onChange={handleTrackChange}
                options={["", "Assamese", "Hindi", "English", "Bengali", "Punjabi"]}
              />

              <Select
                label="Genre"
                name="genre"
                value={track.genre}
                onChange={handleTrackChange}
                options={[
                  "",
                  "Pop",
                  "Folk",
                  "Hip-Hop",
                  "Devotional",
                  "Classical",
                  "Instrumental",
                ]}
              />

              <Select
                label="Mood"
                name="mood"
                value={track.mood}
                onChange={handleTrackChange}
                options={[
                  "",
                  "Romantic",
                  "Sad",
                  "Happy",
                  "Energetic",
                  "Calm",
                  "Devotional",
                ]}
              />
            </div>

            <hr />

            <div className="grid-2">
              <Input
                label="CRBT Title"
                name="crbt_title"
                value={track.crbt_title}
                onChange={handleTrackChange}
              />

              <Input
                label="CRBT Starting Time"
                name="crbt_starting_time"
                placeholder="MM:SS"
                value={track.crbt_starting_time}
                onChange={handleTrackChange}
              />
            </div>

            <div className="modal-actions">
              <button className="cancel-btn" onClick={closeModal}>
                Cancel
              </button>

              <button className="add-btn" onClick={saveTrack}>
                {editIndex !== null ? "Update Song" : "Add Song"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Input = ({ label, required, ...props }) => (
  <div className="field">
    <label>
      {label} {required && <span>*</span>}
    </label>
    <input {...props} />
  </div>
);

const Select = ({ label, options, ...props }) => (
  <div className="field">
    <label>{label}</label>
    <select {...props}>
      {options.map((op) => (
        <option key={op} value={op}>
          {op || "Select"}
        </option>
      ))}
    </select>
  </div>
);

const WaveformPlayer = ({ url }) => {
  const containerRef = useRef(null);
  const waveRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    waveRef.current = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "#62748e",
      progressColor: "#00ffaa",
      cursorColor: "#ffffff",
      height: 60,
      barWidth: 2,
      barGap: 2,
      responsive: true,
    });

    waveRef.current.load(url);

    return () => {
      if (waveRef.current) waveRef.current.destroy();
    };
  }, [url]);

  const togglePlay = () => {
    if (!waveRef.current) return;
    waveRef.current.playPause();
    setPlaying(!playing);
  };

  return (
    <div className="waveform-player">
      <button onClick={togglePlay}>{playing ? "Pause" : "Play"}</button>
      <div ref={containerRef} className="waveform" />
    </div>
  );
};

const TrackRow = ({ track, index, editTrack, removeTrack }) => (
  <div className="track-row">
    <div className="track-count">{index + 1}</div>

    <div className="track-info">
      <h4>{track.song_name}</h4>

      <p>
        {track.singer_name} · {track.category} · {track.isrc || "No ISRC"}
      </p>

      {track.audio_preview && <WaveformPlayer url={track.audio_preview} />}
    </div>

    <div className="track-actions">
      <button className="edit-btn" onClick={() => editTrack(index)}>
        Edit
      </button>

      <button className="remove-btn" onClick={() => removeTrack(index)}>
        Remove
      </button>
    </div>
  </div>
);

export default CreateRelease;