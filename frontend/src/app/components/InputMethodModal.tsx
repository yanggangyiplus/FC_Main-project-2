import { X, Mic, Camera, FileText, Play, Square, Pause, RotateCcw, Eye, Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";

interface InputMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (method: 'voice' | 'camera' | 'text', text?: string) => void;
}

export function InputMethodModal({ isOpen, onClose, onSelect }: InputMethodModalProps) {
  const [activeMethod, setActiveMethod] = useState<'voice' | 'camera' | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [text, setText] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

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

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const url = URL.createObjectURL(audioBlob);
        setAudioBlob(audioBlob);
        setAudioUrl(url);
        setIsRecording(false);
        stream.getTracks().forEach(track => track.stop());
        
        // STT로 텍스트 추출
        await transcribeAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);

      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, 10000);

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

  // STT로 음성을 텍스트로 변환
  const transcribeAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      const audioFile = new File([audioBlob], 'recording.wav', { type: 'audio/wav' });
      const response = await apiClient.transcribeAudio(audioFile, 'todo');
      
      if (response.data && response.data.text) {
        const transcribedText = response.data.text;
        // 최대 1000자로 제한
        const limitedText = transcribedText.slice(0, 1000);
        setText(prev => {
          const newText = prev ? prev + '\n' + limitedText : limitedText;
          return newText.slice(0, 1000);
        });
        toast.success("음성이 텍스트로 변환되었습니다.");
      }
    } catch (error) {
      console.error("STT error:", error);
      toast.error("음성 변환에 실패했습니다.");
    } finally {
      setIsProcessing(false);
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

        // Convert to Blob for OCR
        canvas.toBlob(async (blob) => {
          if (blob) {
            await extractTextFromImage(blob);
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

  // OCR로 이미지에서 텍스트 추출
  const extractTextFromImage = async (blob: Blob) => {
    setIsUploading(true);
    setIsProcessing(true);
    try {
      const imageFile = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
      const response = await apiClient.extractTextFromImage(imageFile, 'gemini');
      
      if (response.data && response.data.text) {
        const extractedText = response.data.text;
        // 최대 1000자로 제한
        const limitedText = extractedText.slice(0, 1000);
        setText(prev => {
          const newText = prev ? prev + '\n' + limitedText : limitedText;
          return newText.slice(0, 1000);
        });
        toast.success("이미지에서 텍스트를 추출했습니다.");
      }
    } catch (error) {
      console.error("OCR error:", error);
      toast.error("텍스트 추출에 실패했습니다.");
    } finally {
      setIsUploading(false);
      setIsProcessing(false);
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
    onSelect('text', text);
  };

  const handleSave = () => {
    if (text.trim()) {
      onSelect('text', text);
    } else {
      toast.error("텍스트를 입력해주세요.");
    }
  };

  const handleClose = () => {
    handleStopRecording();
    if (audioPlayerRef.current) audioPlayerRef.current.pause();
    if (stream) stream.getTracks().forEach(track => track.stop());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="w-full max-w-[375px] h-screen bg-[#F5F5F5] flex flex-col relative">
        {/* Header - 항상 상단에 고정 */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-4 bg-white border-b border-[#E5E7EB] z-[100]">
          <h2 className="font-semibold text-[#1F2937]">일정 추가</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors"
            disabled={isProcessing}
          >
            <X size={24} className="text-[#6B7280]" />
          </button>
        </div>

        {/* Content - 스크롤 가능 */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col items-center px-6 py-8">
            <div className="text-center mb-8">
              <h3 className="text-xl font-semibold text-[#1F2937] border-b-2 border-[#D1D5DB] inline-block pb-2">
                일정 작성
              </h3>
            </div>

          {/* 텍스트 입력 영역 */}
          <div className="w-full bg-white rounded-2xl p-4 mb-4 shadow-sm">
            <textarea
              value={text}
              onChange={(e) => {
                const newText = e.target.value.slice(0, 1000);
                setText(newText);
              }}
              placeholder="텍스트를 작성 해 주세요.&#10;최대 1000자"
              className="w-full min-h-[180px] p-4 border border-[#E5E7EB] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#FF9B82] focus:border-transparent text-[#1F2937] placeholder-[#9CA3AF]"
              maxLength={1000}
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-[#9CA3AF]">
                {text.length} / 1000자
              </span>
              {isProcessing && (
                <div className="flex items-center gap-2 text-xs text-[#FF9B82]">
                  <Loader2 size={14} className="animate-spin" />
                  처리 중...
                </div>
              )}
            </div>
          </div>

          {/* Voice UI */}
          {activeMethod === 'voice' && (
            <div className="w-full bg-white rounded-2xl p-6 mb-4 shadow-sm">
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full bg-[#FF9B82] ${isRecording ? 'animate-pulse' : ''}`} />
                  <span className="text-sm text-[#6B7280]">
                    {isRecording ? '녹음 중... (최대 10초)' : '녹음 완료'}
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
              {activeMethod === 'camera' ? (
                <>사진에서<br />텍스트를 읽고 있습니다.</>
              ) : activeMethod === 'voice' ? (
                <>녹음을<br />시작합니다.</>
              ) : (
                <>텍스트를<br />입력해주세요.</>
              )}
            </p>
          </div>

          <div className="flex justify-center gap-6 mb-4">
            <button 
              onClick={handleVoiceClick} 
              disabled={isProcessing}
              className="w-20 h-20 rounded-full bg-white border-2 border-[#E5E7EB] flex items-center justify-center hover:bg-[#FFF5F0] hover:border-[#FF9B82] shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
              <Mic size={32} className="text-[#FF9B82]" />
            </button>
            <button 
              onClick={handleCameraClick} 
              disabled={isProcessing}
              className="w-20 h-20 rounded-full bg-white border-2 border-[#E5E7EB] flex items-center justify-center hover:bg-[#FFF5F0] hover:border-[#FF9B82] shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
              <Camera size={32} className="text-[#FF9B82]" />
            </button>
            <button 
              onClick={handleTextClick} 
              disabled={isProcessing}
              className="w-20 h-20 rounded-full bg-white border-2 border-[#E5E7EB] flex items-center justify-center hover:bg-[#FFF5F0] hover:border-[#FF9B82] shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
              <FileText size={32} className="text-[#FF9B82]" />
            </button>
          </div>

            {/* 저장 버튼 */}
            <button
              onClick={handleSave}
              disabled={!text.trim() || isProcessing}
              className="w-full py-3 bg-[#FF9B82] text-white rounded-lg font-medium hover:bg-[#FF8A6D] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  처리 중...
                </>
              ) : (
                '저장'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}