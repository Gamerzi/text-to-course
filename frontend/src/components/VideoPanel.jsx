import heroVideo from "../assets/videos/HoodyGuy.mp4";
import "../styles/VideoPanel.css";

export default function VideoPanel() {
    return (
        <div className="video-panel" aria-hidden="true">
            <video
                className="video-panel__video"
                src={heroVideo}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
            />
            <div className="video-panel__shade" />
        </div>
    );
}