import { X, Mic, Camera, FileText, Play, Square, Pause, RotateCcw, Eye } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface InputMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (method: 'voice' | 'camera' | 'text') => void;
}

export function InputMethodModal({ isOpen, onClose, onSelect }: InputMethodModalProps) {
  const [activeMethod, setActiveMethod] = useState<'voice' | 'camera' | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  // Audio Recording State
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Camera State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    return () => {
      // Cleanup URL on unmount
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      // Stop camera stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [audioUrl, stream]);

  if (!isOpen) return null;

  // --- Voice Logic (Preserved) ---
  const handleVoiceClick = async () => {
    setActiveMethod('voice');
    setAudioBlob(null);
    setAudioUrl(null);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const url = URL.createObjectURL(audioBlob);
        setAudioBlob(audioBlob);
        setAudioUrl(url);
        setIsRecording(false);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);

      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, 30000); // 30초로 변경

    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("마이크 접근 권한이 필요합니다.");
      setActiveMethod(null);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const handlePlayAudio = () => {
    if (audioUrl) {
      if (!audioPlayerRef.current) {
        audioPlayerRef.current = new Audio(audioUrl);
        audioPlayerRef.current.onended = () => setIsPlaying(false);
      }
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  const handlePauseAudio = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    }
  };

  // --- Camera Logic ---
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error("Camera error:", error);
      alert("카메라 접근 권한이 필요합니다.");
      setActiveMethod(null);
    }
  };

  const handleCameraClick = () => {
    setActiveMethod('camera');
    setCapturedImage(null);
    startCamera();
  };

  const handleCapture = async () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const imageUrl = canvas.toDataURL("image/jpeg");
        setCapturedImage(imageUrl);

        // Convert to Blob for upload
        canvas.toBlob(async (blob) => {
          if (blob) {
            await uploadImage(blob);
          }
        }, 'image/jpeg');
      }

      // Stop stream after capture
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
    }
  };

  const uploadImage = async (blob: Blob) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", blob, "capture.jpg");

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('http://localhost:8000/memos/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload failed response:', response.status, errorText);
        throw new Error(`Upload failed: ${response.status} ${errorText}`);
      }
      console.log("Image uploaded and saved as Memo");
      // alert("이미지가 저장되었습니다."); // Optional feedback
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("이미지 저장에 실패했습니다.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera();
  };

  const handleView = () => {
    // Already viewing the captured image, but this button is explicit confirmation
    // Could open a modal or just do nothing as per user request "showing function only"
    // For now, maybe just full-screen preview or toast?
    alert("이미지가 저장되었습니다. 나중에 메모함에서 확인하세요.");
  };

  const handleTextClick = () => {
    onSelect('text');
  };

  const handleClose = () => {
    handleStopRecording();
    if (audioPlayerRef.current) audioPlayerRef.current.pause();
    if (stream) stream.getTracks().forEach(track => track.stop());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="w-full max-w-[375px] min-h-screen bg-[#F5F5F5] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 bg-white border-b border-[#E5E7EB]">
          <h2 className="font-semibold text-[#1F2937]">일정 추가</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors"
          >
            <X size={24} className="text-[#6B7280]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
          <div className="text-center mb-8">
            <h3 className="text-xl font-semibold text-[#1F2937] border-b-2 border-[#D1D5DB] inline-block pb-2">
              일정 작성
            </h3>
          </div>

          <div className="w-full bg-white rounded-2xl p-8 mb-4 min-h-[180px] flex items-center justify-center shadow-sm">
            <p className="text-[#9CA3AF] text-center">
              텍스트를 작성 해 주세요.<br />
              최대 1000자
            </p>
          </div>

          {/* Voice UI */}
          {activeMethod === 'voice' && (
            <div className="w-full bg-white rounded-2xl p-6 mb-4 shadow-sm">
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full bg-[#FF9B82] ${isRecording ? 'animate-pulse' : ''}`} />
                  <span className="text-sm text-[#6B7280]">
                    {isRecording ? '녹음 중... (최대 30초)' : '녹음 완료'}
                  </span>
                </div>

                <div className="flex items-center justify-center gap-1 h-16">
                  {isRecording ? (
                    [...Array(20)].map((_, i) => (
                      <div key={i} className="w-1 bg-[#FF9B82] rounded-full" style={{ height: `${Math.random() * 48 + 8}px`, animation: `wave 0.5s ease-in-out infinite ${i * 0.05}s` }} />
                    ))
                  ) : (
                    <div className="h-1 bg-gray-200 w-full rounded" />
                  )}
                  <style>{`@keyframes wave { 0%, 100% { height: 8px; } 50% { height: ${Math.random() * 40 + 16}px; } }`}</style>
                </div>

                <div className="flex gap-3">
                  {isRecording ? (
                    <button onClick={handleStopRecording} className="px-6 py-2 bg-[#F3F4F6] text-[#6B7280] rounded-lg hover:bg-[#E5E7EB] flex items-center gap-2">
                      <Square size={16} fill="currentColor" /> 중지
                    </button>
                  ) : (
                    <button onClick={() => setActiveMethod(null)} className="px-6 py-2 bg-[#F3F4F6] text-[#6B7280] rounded-lg hover:bg-[#E5E7EB]">
                      취소
                    </button>
                  )}
                  {!isRecording && audioUrl && (
                    <button onClick={isPlaying ? handlePauseAudio : handlePlayAudio} className="px-6 py-2 bg-[#FF9B82] text-white rounded-lg hover:bg-[#FF8A6D] flex items-center gap-2">
                      {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                      {isPlaying ? "일시정지" : "재생"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Camera UI */}
          {activeMethod === 'camera' && (
            <div className="w-full bg-white rounded-2xl p-6 mb-4 shadow-sm">
              <div className="flex flex-col items-center gap-4">
                <div className="w-full aspect-video bg-[#1F2937] rounded-lg overflow-hidden flex items-center justify-center relative">
                  {capturedImage ? (
                    <>
                      <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
                      {isUploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white">
                          저장 중...
                        </div>
                      )}
                    </>
                  ) : (
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  )}
                </div>

                <div className="flex gap-2 w-full justify-between">
                  {capturedImage ? (
                    <>
                      <button onClick={handleCapture} disabled className="flex-1 py-2 bg-gray-200 text-gray-400 rounded-lg flex items-center justify-center gap-1 cursor-not-allowed">
                        <Camera size={18} /> 촬영
                      </button>
                      <button onClick={handleRetake} className="flex-1 py-2 bg-[#F3F4F6] text-[#6B7280] rounded-lg hover:bg-[#E5E7EB] flex items-center justify-center gap-1">
                        <RotateCcw size={18} /> 재촬영
                      </button>
                      <button onClick={handleView} className="flex-1 py-2 bg-[#FF9B82] text-white rounded-lg hover:bg-[#FF8A6D] flex items-center justify-center gap-1">
                        <Eye size={18} /> 보기
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={handleCapture} className="flex-1 py-2 bg-[#FF9B82] text-white rounded-lg hover:bg-[#FF8A6D] flex items-center justify-center gap-1">
                        <Camera size={18} /> 촬영
                      </button>
                      <button disabled className="flex-1 py-2 bg-gray-100 text-gray-300 rounded-lg flex items-center justify-center gap-1">
                        <RotateCcw size={18} /> 재촬영
                      </button>
                      <button disabled className="flex-1 py-2 bg-gray-100 text-gray-300 rounded-lg flex items-center justify-center gap-1">
                        <Eye size={18} /> 보기
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="text-center mb-6">
            <p className="text-[#6B7280]">
              녹음을<br />시작합니다.
            </p>
          </div>

          <div className="flex justify-center gap-6">
            <button onClick={handleVoiceClick} className="w-20 h-20 rounded-full bg-white border-2 border-[#E5E7EB] flex items-center justify-center hover:bg-[#FFF5F0] hover:border-[#FF9B82] shadow-md active:scale-95">
              <Mic size={32} className="text-[#FF9B82]" />
            </button>
            <button onClick={handleCameraClick} className="w-20 h-20 rounded-full bg-white border-2 border-[#E5E7EB] flex items-center justify-center hover:bg-[#FFF5F0] hover:border-[#FF9B82] shadow-md active:scale-95">
              <Camera size={32} className="text-[#FF9B82]" />
            </button>
            <button onClick={handleTextClick} className="w-20 h-20 rounded-full bg-white border-2 border-[#E5E7EB] flex items-center justify-center hover:bg-[#FFF5F0] hover:border-[#FF9B82] shadow-md active:scale-95">
              <FileText size={32} className="text-[#FF9B82]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}