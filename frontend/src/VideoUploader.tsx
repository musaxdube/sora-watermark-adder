import React, { useState, useEffect } from "react";

const VideoUploader: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [fileId, setFileId] = useState<string | null>(null);
  const [percent, setPercent] = useState<number>(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const API_BASE = "https://sora-watermark-api.vercel.app";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setMessage("");
      setPercent(0);
      setFileId(null);
      setDownloadUrl(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setMessage("Please select a video first.");
      return;
    }

    try {
      setMessage("Uploading...");
      const formData = new FormData();
      formData.append("video", selectedFile);

      const response = await fetch(`${API_BASE}/upload`, { // use full URL if no proxy: "http://localhost:3000/upload"
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error(`Upload failed: ${response.statusText}`);

      const data = await response.json();
      setFileId(data.fileId);
      setMessage("Processing started...");

    } catch (error: any) {
      console.error("Upload error:", error);
      setMessage("❌ Upload failed. Check console.");
    }
  };

  // Polling for progress
  useEffect(() => {
    if (!fileId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/progress/${fileId}`);
        if (!res.ok) throw new Error("Progress fetch failed");

        const data = await res.json();
        setPercent(data.percent || 0);
        setMessage(data.status);

        if (data.status === "Done") {
          clearInterval(interval);
          setDownloadUrl(`${API_BASE}/download/${fileId}`);
          setMessage("✅ Processing complete!");
        }
      } catch (err) {
        console.error(err);
        clearInterval(interval);
        setMessage("❌ Error fetching progress");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [fileId]);

  return (
    <div className="p-6 bg-gray-100 rounded-xl shadow-md text-center max-w-md mx-auto mt-10">
      <h1 className="text-2xl font-semibold mb-4 flex justify-center items-center gap-2">
        🎥 Video Watermark Uploader
      </h1>

      <input
        type="file"
        accept="video/*"
        onChange={handleFileChange}
        className="mb-4"
      />

      <button
        onClick={handleUpload}
        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded mb-4"
      >
        Upload
      </button>

      {message && <p className="mb-2 text-gray-700">{message}</p>}

      {fileId && (
        <div className="w-full bg-gray-300 rounded h-4 mb-2">
          <div
            className="bg-green-500 h-4 rounded"
            style={{ width: `${percent}%` }}
          ></div>
        </div>
      )}

      {downloadUrl && (
        <a
          href={downloadUrl}
          download="watermarked.mp4"
          className="inline-block mt-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
        >
          Download Video
        </a>
      )}
    </div>
  );
};

export default VideoUploader;
