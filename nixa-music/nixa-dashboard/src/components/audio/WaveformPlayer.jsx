import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play } from "lucide-react";
import WaveSurfer from "wavesurfer.js";

const WaveformPlayer = ({ src, title = "Audio preview" }) => {
  const containerRef = useRef(null);
  const waveSurferRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setReady(false);
    setPlaying(false);
    setFailed(false);

    if (!src || !containerRef.current) {
      return undefined;
    }

    const waveSurfer = WaveSurfer.create({
      container: containerRef.current,
      url: src,
      height: 54,
      normalize: true,
      barWidth: 2,
      barGap: 2,
      barRadius: 3,
      cursorWidth: 0,
      waveColor: "rgba(125, 211, 252, 0.34)",
      progressColor: "#d946ef",
      mediaControls: false,
    });

    waveSurferRef.current = waveSurfer;
    waveSurfer.on("ready", () => setReady(true));
    waveSurfer.on("play", () => setPlaying(true));
    waveSurfer.on("pause", () => setPlaying(false));
    waveSurfer.on("finish", () => setPlaying(false));
    waveSurfer.on("error", () => {
      setFailed(true);
      setReady(true);
    });

    return () => {
      waveSurfer.destroy();
      waveSurferRef.current = null;
    };
  }, [src]);

  const togglePlayback = () => {
    if (!ready || failed || !waveSurferRef.current) {
      return;
    }

    waveSurferRef.current.playPause();
  };

  if (!src) {
    return (
      <div className="waveform-player waveform-empty">
        <span>No audio uploaded</span>
      </div>
    );
  }

  return (
    <div className={failed ? "waveform-player waveform-error" : "waveform-player"} aria-label={title}>
      <button type="button" onClick={togglePlayback} disabled={!ready || failed} aria-label={playing ? "Pause audio" : "Play audio"}>
        {!ready ? <Loader2 className="spin" size={16} /> : playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <div className="waveform-canvas" ref={containerRef} />
      {failed && <span>Audio preview unavailable</span>}
    </div>
  );
};

export default WaveformPlayer;
