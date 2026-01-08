import { X, Mic, Camera, FileText, Play, Square, Pause, RotateCcw, Eye, Upload, FileSearch } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";

interface ExtractedTodoInfo {
  title?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  isAllDay?: boolean;
  category?: string;
  checklistItems?: string[];
  location?: string;
  memo?: string;
  repeatType?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  hasNotification?: boolean;
  alarmTimes?: string[];
}

interface InputMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (method: 'voice' | 'camera' | 'text', extractedText?: string, todoInfo?: ExtractedTodoInfo) => void;
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [currentImageBlob, setCurrentImageBlob] = useState<Blob | null>(null); // 현재 이미지 Blob 저장
  const [extractionFailed, setExtractionFailed] = useState(false); // 추출 실패 여부
  // STT State
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribedText, setTranscribedText] = useState<string>("");
  // LLM 일정 정보 추출 State
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedTodoInfo, setExtractedTodoInfo] = useState<ExtractedTodoInfo | null>(null);

  // transcribedText 상태 변경 디버깅
  useEffect(() => {
    console.log("transcribedText 상태 변경됨:", transcribedText);
  }, [transcribedText]);

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

        // 녹음 완료 후 STT 처리
        try {
          setIsTranscribing(true);
          const audioFile = new File([audioBlob], 'recording.wav', { type: 'audio/wav' });
          console.log("STT 처리 시작:", audioFile);
          const response = await apiClient.transcribeAudio(audioFile, 'todo');
          console.log("STT 응답:", response);

          if (response && response.data && response.data.text) {
            const text = response.data.text;
            setTranscribedText(text);
            toast.success("음성이 텍스트로 변환되었습니다.");

            // LLM으로 일정 정보 추출
            try {
              setIsExtracting(true);
              console.log("일정 정보 추출 시작:", text);
              const todoInfoResponse = await apiClient.extractTodoInfo(text);
              console.log("일정 정보 추출 응답:", todoInfoResponse);

              if (todoInfoResponse && todoInfoResponse.data) {
                const info = todoInfoResponse.data;
                const extractedInfo: ExtractedTodoInfo = {
                  title: info.title || '',
                  date: info.date,
                  startTime: info.start_time || undefined,
                  endTime: info.end_time || undefined,
                  isAllDay: info.all_day || false,
                  category: info.category || '기타',
                  checklistItems: info.checklist && info.checklist.length > 0 ? info.checklist : [],
                  location: info.location || '',
                  memo: info.memo || text,
                  repeatType: info.repeat_type || 'none',
                  hasNotification: info.has_notification || false,
                  alarmTimes: info.notification_times || [],
                };
                setExtractedTodoInfo(extractedInfo);
                toast.success("일정 정보가 자동으로 추출되었습니다.");
              } else {
                console.error("일정 정보 추출 응답 데이터 없음:", todoInfoResponse);
                toast.error("일정 정보 추출에 실패했습니다.");
              }
            } catch (error: any) {
              console.error("일정 정보 추출 실패:", error);
              console.error("에러 상세:", error.response?.data || error.message);
              toast.error(`일정 정보 추출 실패: ${error.response?.data?.detail || error.message || "알 수 없는 오류"}`);
            } finally {
              setIsExtracting(false);
            }
          } else {
            console.error("STT 응답 데이터 없음:", response);
            toast.error("음성 변환에 실패했습니다.");
          }
        } catch (error: any) {
          console.error("STT 처리 실패:", error);
          console.error("에러 상세:", error.response?.data || error.message);
          toast.error(`음성 변환 실패: ${error.response?.data?.detail || error.message || "알 수 없는 오류"}`);
        } finally {
          setIsTranscribing(false);
        }
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
    setTranscribedText("");
    setExtractedTodoInfo(null);
    // 카메라 시작은 사용자가 선택하도록 변경
  };

  // 파일 선택 핸들러
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 이미지 파일인지 확인
    if (!file.type.startsWith('image/')) {
      toast.error("이미지 파일만 선택할 수 있습니다.");
      return;
    }

    // 파일을 Blob으로 변환하여 처리
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string;
      setCapturedImage(imageUrl);
    };
    reader.readAsDataURL(file);

    // Blob으로 변환하여 저장
    const blob = file.slice(0, file.size, file.type);
    setCurrentImageBlob(blob);

    // 텍스트와 일정 정보 초기화
    setTranscribedText("");
    setExtractedTodoInfo(null);
    setExtractionFailed(false);

    // 자동으로 텍스트 추출 시도
    try {
      await uploadImage(blob);
    } catch (error) {
      console.error("자동 텍스트 추출 실패:", error);
      setExtractionFailed(true);
    }

    // 파일 input 초기화
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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

        // Convert to Blob for storage
        canvas.toBlob(async (blob) => {
          if (blob) {
            setCurrentImageBlob(blob);
            // 텍스트와 일정 정보 초기화
            setTranscribedText("");
            setExtractedTodoInfo(null);
            setExtractionFailed(false);

            // 자동으로 텍스트 추출 시도
            try {
              await uploadImage(blob);
            } catch (error) {
              console.error("자동 텍스트 추출 실패:", error);
              setExtractionFailed(true);
            }
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

  // 수동 텍스트 추출 핸들러
  const handleExtractText = async () => {
    if (!currentImageBlob) {
      toast.error("이미지가 없습니다.");
      return;
    }

    setExtractionFailed(false);
    await uploadImage(currentImageBlob);
  };

  const uploadImage = async (blob: Blob) => {
    setIsUploading(true);
    setExtractionFailed(false);

    try {
      // OCR로 텍스트 추출
      const ocrResponse = await apiClient.extractTextFromImage(blob);
      console.log("OCR 응답 전체:", ocrResponse);
      console.log("OCR 응답 data:", ocrResponse?.data);
      console.log("OCR 응답 data JSON:", JSON.stringify(ocrResponse?.data, null, 2));
      console.log("OCR 응답 data.text:", ocrResponse?.data?.text);
      console.log("OCR 응답 data.data:", ocrResponse?.data?.data);
      console.log("OCR 응답 data.data?.text:", ocrResponse?.data?.data?.text);

      // 응답 구조 확인 및 텍스트 추출 (여러 가능한 구조 시도)
      const extractedText = ocrResponse?.data?.text
        || ocrResponse?.data?.data?.text
        || (typeof ocrResponse?.data === 'string' ? ocrResponse.data : "")
        || "";

      console.log("추출된 텍스트:", extractedText);
      console.log("추출된 텍스트 길이:", extractedText?.length);
      console.log("transcribedText 상태 업데이트 전:", transcribedText);

      if (extractedText && extractedText.trim().length > 0) {
        setTranscribedText(extractedText);
        console.log("transcribedText 상태 업데이트 후:", extractedText);
        toast.success("이미지에서 텍스트를 추출했습니다.");

        // LLM으로 일정 정보 추출
        try {
          setIsExtracting(true);
          console.log("일정 정보 추출 시작:", extractedText);
          const todoInfoResponse = await apiClient.extractTodoInfo(extractedText);
          console.log("일정 정보 추출 응답:", todoInfoResponse);

          if (todoInfoResponse && todoInfoResponse.data) {
            const info = todoInfoResponse.data;
            const extractedInfo: ExtractedTodoInfo = {
              title: info.title || '',
              date: info.date,
              startTime: info.start_time || undefined,
              endTime: info.end_time || undefined,
              isAllDay: info.all_day || false,
              category: info.category || '기타',
              checklistItems: info.checklist && info.checklist.length > 0 ? info.checklist : [],
              location: info.location || '',
              memo: info.memo || extractedText,
              repeatType: info.repeat_type || 'none',
              hasNotification: info.has_notification || false,
              alarmTimes: info.notification_times || [],
            };
            setExtractedTodoInfo(extractedInfo);
            toast.success("일정 정보가 자동으로 추출되었습니다.");
            setExtractionFailed(false);
          } else {
            console.error("일정 정보 추출 응답 데이터 없음:", todoInfoResponse);
            toast.error("일정 정보 추출에 실패했습니다.");
            setExtractionFailed(true);
          }
        } catch (error: any) {
          console.error("일정 정보 추출 실패:", error);
          console.error("에러 상세:", error.response?.data || error.message);
          toast.error(`일정 정보 추출 실패: ${error.response?.data?.detail || error.message || "알 수 없는 오류"}`);
          setExtractionFailed(true);
        } finally {
          setIsExtracting(false);
        }
      } else {
        console.error("OCR 응답 데이터 없음:", ocrResponse);
        toast.error("텍스트 추출에 실패했습니다.");
        setExtractionFailed(true);
      }
    } catch (error: any) {
      console.error("Error processing image:", error);
      console.error("에러 상세:", error.response?.data || error.message);
      toast.error(`이미지 처리 실패: ${error.response?.data?.detail || error.message || "알 수 없는 오류"}`);
      setExtractionFailed(true);
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
              value={transcribedText}
              onChange={(e) => {
                if (e.target.value.length <= 1000) {
                  setTranscribedText(e.target.value);
                }
              }}
              placeholder="텍스트를 작성해주세요. (최대 1000자)"
              className="w-full min-h-[120px] p-3 border border-[#E5E7EB] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#FF9B82] text-sm text-[#1F2937]"
              maxLength={1000}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-[#9CA3AF]">
                {transcribedText.length}/1000자
              </span>
              {transcribedText.trim().length > 0 && (
                <button
                  onClick={() => {
                    onSelect('text', transcribedText, extractedTodoInfo || undefined);
                    setTranscribedText("");
                    setExtractedTodoInfo(null);
                    setActiveMethod(null);
                  }}
                  disabled={isExtracting}
                  className="px-4 py-2 bg-[#FF9B82] text-white rounded-lg hover:bg-[#FF8A6D] text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExtracting ? '일정 정보 추출 중...' : extractedTodoInfo ? '일정 추가하기' : '저장'}
                </button>
              )}
            </div>
          </div>

          {/* Voice UI */}
          {activeMethod === 'voice' && (
            <div className="w-full bg-white rounded-2xl p-6 mb-4 shadow-sm">
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full bg-[#FF9B82] ${isRecording || isTranscribing ? 'animate-pulse' : ''}`} />
                  <span className="text-sm text-[#6B7280]">
                    {isRecording
                      ? '녹음 중... (최대 30초)'
                      : isTranscribing
                        ? '음성을 텍스트로 변환 중...'
                        : isExtracting
                          ? '일정 정보 추출 중...'
                          : '녹음 완료'}
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
                      {(isUploading || isExtracting) && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white">
                          {isUploading ? '텍스트 추출 중...' : '일정 정보 추출 중...'}
                        </div>
                      )}
                    </>
                  ) : stream ? (
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-sm">
                      사진을 첨부해 주세요.
                    </div>
                  )}
                </div>

                {/* 숨겨진 파일 input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <div className="flex gap-2 w-full justify-between">
                  {capturedImage ? (
                    <>
                      <button onClick={handleCapture} disabled className="flex-1 py-2 bg-gray-200 text-gray-400 rounded-lg flex items-center justify-center gap-1 cursor-not-allowed">
                        <Camera size={18} /> 촬영
                      </button>
                      <button
                        onClick={handleExtractText}
                        disabled={isUploading || isExtracting || !currentImageBlob}
                        className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed ${extractionFailed || !transcribedText
                          ? 'bg-[#6366F1] text-white hover:bg-[#5558E3]'
                          : 'bg-[#10B981] text-white hover:bg-[#059669]'
                          }`}
                      >
                        <FileSearch size={18} />
                        {isUploading || isExtracting
                          ? '추출 중...'
                          : extractionFailed || !transcribedText
                            ? '텍스트 추출'
                            : '다시 추출'}
                      </button>
                      <button onClick={handleRetake} className="flex-1 py-2 bg-[#F3F4F6] text-[#6B7280] rounded-lg hover:bg-[#E5E7EB] flex items-center justify-center gap-1">
                        <RotateCcw size={18} /> 다시 선택
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          if (!stream) {
                            startCamera();
                          } else {
                            handleCapture();
                          }
                        }}
                        className="flex-1 py-2 bg-[#FF9B82] text-white rounded-lg hover:bg-[#FF8A6D] flex items-center justify-center gap-1"
                      >
                        <Camera size={18} /> {stream ? '촬영' : '카메라'}
                      </button>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 py-2 bg-[#6366F1] text-white rounded-lg hover:bg-[#5558E3] flex items-center justify-center gap-1"
                      >
                        <Upload size={18} /> 업로드
                      </button>
                      <button
                        onClick={() => {
                          if (stream) {
                            stream.getTracks().forEach(track => track.stop());
                            setStream(null);
                          }
                          setActiveMethod(null);
                        }}
                        className="flex-1 py-2 bg-[#F3F4F6] text-[#6B7280] rounded-lg hover:bg-[#E5E7EB] flex items-center justify-center gap-1"
                      >
                        취소
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="text-center mb-6">
            <p className="text-[#6B7280]">
              {activeMethod === 'camera'
                ? '텍스트 추출을 시작합니다.'
                : activeMethod === 'voice'
                  ? '녹음을 시작합니다.'
                  : '일정을 작성해주세요.'}
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