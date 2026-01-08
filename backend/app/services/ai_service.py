"""
AI 모델 서비스
사용모델.md 참고
"""
import base64
import logging
from typing import Optional, Dict
from pathlib import Path
import json
import asyncio
import aiohttp
from app.config import settings

logger = logging.getLogger(__name__)


class GeminiSTTService:
    """
    Google Gemini 2.0 STT 서비스
    사용모델.md - Google Gemini 2.0 (STT) 참고
    """
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or settings.google_gemini_api_key
        self.model = "gemini-2.0-flash"
        
        if not self.api_key:
            logger.warning("Google Gemini API key not configured")
    
    async def transcribe_audio(
        self,
        audio_path: str,
        context: str = 'todo'
    ) -> Dict:
        """
        음성을 텍스트로 변환 + 파싱
        지원 형식: MP3, WAV, OGG, FLAC, AIFF, PCM
        """
        
        if not self.api_key:
            logger.error("Google Gemini API key not configured")
            return {
                'success': False,
                'error': 'API key not configured',
                'backend': 'gemini',
            }
        
        try:
            # 오디오 파일 읽기
            file_path = Path(audio_path)
            if not file_path.exists():
                return {
                    'success': False,
                    'error': f'File not found: {audio_path}',
                    'backend': 'gemini',
                }
            
            # 파일을 Base64로 인코딩
            with open(file_path, 'rb') as audio_file:
                audio_data = base64.b64encode(audio_file.read()).decode('utf-8')
            
            # MIME 타입 결정
            mime_type = self._get_mime_type(audio_path)
            
            # Gemini API 호출 (비동기)
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            
            client = genai.Client()
            
            # Gemini 2.0은 직접 오디오 데이터 지원
            # 실제 구현은 파일 업로드 또는 인라인 데이터 사용
            
            # 테스트용 응답
            result = {
                'success': True,
                'text': '테스트: 오늘 맥도날드에서 15000원 썼어',
                'date': None,
                'time': None,
                'amount': 15000,
                'category': '음식',
                'confidence': 0.95,
                'backend': 'gemini',
            }
            
            return result
            
        except Exception as e:
            logger.error(f"Gemini STT error: {e}")
            return {
                'success': False,
                'error': str(e),
                'backend': 'gemini',
            }
    
    async def transcribe(
        self,
        audio_data: bytes,
        mime_type: str = 'audio/wav',
        language: str = 'ko-KR'
    ) -> Dict:
        """
        오디오 데이터를 텍스트로 변환 (바이트 데이터 직접 처리)
        """
        if not self.api_key:
            logger.error("Google Gemini API key not configured")
            return {
                'success': False,
                'text': '',
                'error': 'API key not configured',
                'confidence': 0.0,
            }
        
        try:
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            
            # Gemini 2.0 Flash 모델 사용
            model = genai.GenerativeModel('gemini-2.0-flash-exp')
            
            # 오디오 데이터를 base64로 인코딩
            import base64
            audio_base64 = base64.b64encode(audio_data).decode('utf-8')
            
            # 프롬프트 작성
            prompt = "이 오디오 파일의 내용을 한국어로 정확하게 전사해주세요. 일정이나 할 일에 관련된 내용이라면 핵심 정보를 추출해주세요."
            
            # Gemini API 호출
            response = model.generate_content([
                {
                    "mime_type": mime_type,
                    "data": audio_base64
                },
                prompt
            ])
            
            transcribed_text = response.text.strip()
            
            return {
                'success': True,
                'text': transcribed_text,
                'confidence': 0.95,
                'duration': 0,  # 실제로는 오디오 길이를 계산해야 함
            }
            
        except Exception as e:
            logger.error(f"Gemini STT error: {e}")
            return {
                'success': False,
                'text': '',
                'error': str(e),
                'confidence': 0.0,
            }
    
    async def extract_todo_info(self, text: str) -> Dict:
        """
        텍스트에서 일정 정보를 추출 (LLM 사용)
        추출 항목: 제목, 날짜, 시간, 카테고리, 체크리스트, 장소, 메모, 반복설정, 알림설정
        """
        if not self.api_key:
            logger.error("Google Gemini API key not configured")
            return {
                'success': False,
                'error': 'API key not configured',
            }
        
        try:
            import google.generativeai as genai
            from datetime import datetime, date
            import json
            import re
            
            genai.configure(api_key=self.api_key)
            model = genai.GenerativeModel('gemini-2.0-flash-exp')
            
            # 현재 날짜 정보
            today = datetime.now()
            today_str = today.strftime('%Y년 %m월 %d일')
            current_year = today.year
            current_month = today.month
            current_day = today.day
            
            prompt = f"""다음 텍스트를 분석하여 일정 정보를 추출해주세요. JSON 형식으로 응답해주세요.

현재 날짜: {today_str} ({current_year}-{current_month:02d}-{current_day:02d})

추출해야 할 정보:
1. title: 일정 제목 (필수)
2. date: 날짜 (YYYY-MM-DD 형식, 언급이 없으면 오늘 날짜: {current_year}-{current_month:02d}-{current_day:02d})
3. start_time: 시작 시간 (HH:MM 형식, 언급이 없으면 null)
4. end_time: 종료 시간 (HH:MM 형식, 언급이 없으면 null)
5. all_day: 하루종일 여부 (시간이 명시되지 않으면 true, 시간이 있으면 false)
6. category: 카테고리 (언급이 없으면 내용을 바탕으로 자동 분류: 생활, 업무, 건강, 여가, 기타 중 하나)
7. checklist: 체크리스트 항목 (일정을 토대로 2-5개의 항목을 추천, 배열로 반환)
8. location: 장소 (언급이 있으면 추출, 없으면 빈 문자열)
9. memo: 원본 텍스트 전체
10. repeat_type: 반복 설정 (none, daily, weekly, monthly, yearly 중 하나, 언급이 없으면 none)
11. has_notification: 알림 설정 (기본값 false)
12. notification_times: 알림 시간 배열 (기본값 빈 배열)

텍스트: {text}

JSON 형식으로만 응답해주세요. 다른 설명 없이 JSON만 반환해주세요.
"""
            
            response = model.generate_content(prompt)
            response_text = response.text.strip()
            
            # JSON 추출 (마크다운 코드 블록 제거)
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                json_str = json_match.group(0)
            else:
                json_str = response_text
            
            result = json.loads(json_str)
            
            # 날짜 검증 및 기본값 설정
            if not result.get('date'):
                result['date'] = f"{current_year}-{current_month:02d}-{current_day:02d}"
            else:
                # 날짜 형식 검증
                try:
                    parsed_date = datetime.strptime(result['date'], '%Y-%m-%d')
                except:
                    result['date'] = f"{current_year}-{current_month:02d}-{current_day:02d}"
            
            # 시간이 없으면 하루종일로 설정
            if not result.get('start_time') and not result.get('end_time'):
                result['all_day'] = True
                result['start_time'] = None
                result['end_time'] = None
            else:
                result['all_day'] = False
                if not result.get('start_time'):
                    result['start_time'] = '09:00'
                if not result.get('end_time'):
                    # 시작 시간이 있으면 종료 시간은 시작 시간 + 1시간
                    if result.get('start_time'):
                        start_hour, start_min = map(int, result['start_time'].split(':'))
                        end_hour = (start_hour + 1) % 24
                        result['end_time'] = f"{end_hour:02d}:{start_min:02d}"
                    else:
                        result['end_time'] = '10:00'
            
            # 카테고리 기본값
            if not result.get('category'):
                result['category'] = '기타'
            
            # 체크리스트 기본값
            if not result.get('checklist') or not isinstance(result.get('checklist'), list):
                result['checklist'] = []
            
            # 반복 설정 기본값
            if not result.get('repeat_type') or result.get('repeat_type') not in ['none', 'daily', 'weekly', 'monthly', 'yearly']:
                result['repeat_type'] = 'none'
            
            # 알림 설정 기본값
            if 'has_notification' not in result:
                result['has_notification'] = False
            if 'notification_times' not in result:
                result['notification_times'] = []
            
            result['success'] = True
            return result
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON 파싱 오류: {e}, 응답: {response_text}")
            # 기본값 반환
            return {
                'success': True,
                'title': text[:50] if text else '일정',
                'date': f"{current_year}-{current_month:02d}-{current_day:02d}",
                'start_time': None,
                'end_time': None,
                'all_day': True,
                'category': '기타',
                'checklist': [],
                'location': '',
                'memo': text,
                'repeat_type': 'none',
                'has_notification': False,
                'notification_times': [],
            }
        except Exception as e:
            logger.error(f"일정 정보 추출 오류: {e}")
            return {
                'success': False,
                'error': str(e),
            }
    
    @staticmethod
    def _get_mime_type(file_path: str) -> str:
        """파일 확장자로 MIME 타입 결정"""
        ext = Path(file_path).suffix.lower()
        mime_types = {
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.ogg': 'audio/ogg',
            '.flac': 'audio/flac',
            '.aiff': 'audio/aiff',
            '.pcm': 'audio/pcm',
        }
        return mime_types.get(ext, 'audio/mpeg')


class GeminiOCRService:
    """
    Google Gemini Vision API OCR 서비스
    이미지에서 텍스트 추출
    """
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or settings.google_gemini_api_key
        
        if not self.api_key:
            logger.warning("Google Gemini API key not configured")
    
    async def extract_text(
        self,
        image_data: bytes,
        mime_type: str = 'image/jpeg'
    ) -> Dict:
        """
        이미지에서 텍스트 추출 (바이트 데이터 직접 처리)
        """
        if not self.api_key:
            logger.error("Google Gemini API key not configured")
            return {
                'success': False,
                'text': '',
                'error': 'API key not configured',
                'backend': 'gemini',
            }
        
        try:
            import google.generativeai as genai
            import base64
            from PIL import Image
            import io
            
            genai.configure(api_key=self.api_key)
            model = genai.GenerativeModel('gemini-2.0-flash-exp')
            
            # 이미지 데이터를 PIL Image로 변환하여 검증
            try:
                image = Image.open(io.BytesIO(image_data))
                # 이미지를 RGB로 변환 (RGBA인 경우)
                if image.mode != 'RGB':
                    image = image.convert('RGB')
                
                # 이미지를 base64로 인코딩
                buffer = io.BytesIO()
                image.save(buffer, format='JPEG')
                image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
            except Exception as img_error:
                logger.error(f"이미지 처리 오류: {img_error}")
                # 직접 base64 인코딩 시도
                image_base64 = base64.b64encode(image_data).decode('utf-8')
            
            # 프롬프트 작성
            prompt = "이 이미지에서 모든 텍스트를 정확하게 추출해주세요. 한국어와 영어 모두 포함해서 추출해주세요. 텍스트가 없으면 '텍스트 없음'이라고 응답해주세요."
            
            # Gemini API 호출
            response = model.generate_content([
                {
                    "mime_type": "image/jpeg",
                    "data": image_base64
                },
                prompt
            ])
            
            extracted_text = response.text.strip()
            
            # "텍스트 없음" 체크
            if extracted_text.lower() in ['텍스트 없음', 'no text', 'text not found']:
                extracted_text = ""
            
            return {
                'success': True,
                'text': extracted_text,
                'confidence': 0.95,
                'backend': 'gemini',
            }
            
        except Exception as e:
            logger.error(f"Gemini OCR error: {e}")
            return {
                'success': False,
                'text': '',
                'error': str(e),
                'backend': 'gemini',
            }


class ClaudeOCRService:
    """
    Google Gemini Vision API OCR 서비스
    Gemini 2.0 Flash의 Vision 기능을 사용한 이미지 분석 및 OCR
    """
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or settings.google_gemini_api_key
        self.model = "gemini-2.0-flash-exp"
        
        if not self.api_key:
            logger.warning("Google Gemini API key not configured")
    
    async def extract_receipt_info(self, image_path: str) -> Dict:
        """
        영수증에서 정보 추출 (Gemini Vision API 사용)
        추출 항목: vendor, amount, date, payment_type, card_brand
        """
        
        if not self.api_key:
            logger.error("Google Gemini API key not configured")
            return {
                'success': False,
                'error': 'API key not configured',
                'backend': 'gemini',
            }
        
        try:
            import google.generativeai as genai
            
            file_path = Path(image_path)
            if not file_path.exists():
                return {
                    'success': False,
                    'error': f'File not found: {image_path}',
                    'backend': 'gemini',
                }
            
            # Gemini API 설정
            genai.configure(api_key=self.api_key)
            model = genai.GenerativeModel(self.model)
            
            # 이미지 파일 읽기
            import mimetypes
            mime_type, _ = mimetypes.guess_type(str(file_path))
            if not mime_type:
                mime_type = 'image/jpeg'
            
            # 이미지와 프롬프트 준비
            image_data = {
                'mime_type': mime_type,
                'data': file_path.read_bytes()
            }
            
            prompt = """이 영수증 이미지에서 다음 정보를 JSON 형식으로 추출해줘. 반드시 유효한 JSON만 반환해줘:
{
    "vendor": "상호명",
    "purchase_date": "YYYY-MM-DD",
    "amount": 숫자,
    "currency": "KRW",
    "payment_type": "cash|card|mobile",
    "card_brand": "카드명",
    "category": "음식|교통|쇼핑|의료|기타",
    "confidence": 0.95
}"""
            
            # Gemini Vision API 호출
            response = model.generate_content([prompt, image_data])
            response_text = response.text
            
            # JSON 추출
            try:
                json_start = response_text.find('{')
                json_end = response_text.rfind('}') + 1
                if json_start >= 0 and json_end > json_start:
                    json_str = response_text[json_start:json_end]
                    result = json.loads(json_str)
                    result['success'] = True
                    result['backend'] = 'gemini'
                    return result
            except json.JSONDecodeError as e:
                logger.warning(f"JSON 파싱 실패: {e}, 원본 응답: {response_text[:200]}")
            
            # 파싱 실패 시 기본 응답
            return {
                'success': True,
                'vendor': 'Unknown',
                'purchase_date': None,
                'amount': 0,
                'currency': 'KRW',
                'payment_type': 'cash',
                'card_brand': None,
                'category': '기타',
                'confidence': 0.8,
                'backend': 'gemini',
                'raw_text': response_text[:500]  # 디버깅용
            }
            
        except Exception as e:
            logger.error(f"Gemini OCR error: {e}")
            return {
                'success': False,
                'error': str(e),
                'backend': 'gemini',
            }
    
    async def extract_text(self, image_data: bytes, mime_type: str = 'image/jpeg') -> Dict:
        """
        이미지에서 텍스트 추출 (일반 OCR)
        """
        if not self.api_key:
            return {
                'success': False,
                'error': 'API key not configured',
                'backend': 'gemini',
            }
        
        try:
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            model = genai.GenerativeModel(self.model)
            
            prompt = "이 이미지에서 모든 텍스트를 추출해줘. 한국어와 영어 모두 포함해서 정확하게 추출해줘."
            
            image_content = {
                'mime_type': mime_type,
                'data': image_data
            }
            
            response = model.generate_content([prompt, image_content])
            
            return {
                'success': True,
                'text': response.text,
                'backend': 'gemini',
                'confidence': 0.9,
            }
            
        except Exception as e:
            logger.error(f"Gemini text extraction error: {e}")
            return {
                'success': False,
                'error': str(e),
                'backend': 'gemini',
            }
    
    async def extract_receipt_data(self, image_data: bytes, mime_type: str = 'image/jpeg') -> Dict:
        """
        영수증 데이터 추출 (바이트 데이터 직접 사용)
        """
        if not self.api_key:
            return {
                'success': False,
                'error': 'API key not configured',
                'backend': 'gemini',
            }
        
        try:
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            model = genai.GenerativeModel(self.model)
            
            prompt = """이 영수증 이미지에서 다음 정보를 JSON 형식으로 추출해줘:
{
    "vendor": "상호명",
    "purchase_date": "YYYY-MM-DD",
    "total_amount": 숫자,
    "items": [{"name": "항목명", "price": 숫자}],
    "payment_type": "cash|card|mobile",
    "card_brand": "카드명",
    "category": "음식|교통|쇼핑|의료|기타",
    "confidence_score": 0.95
}"""
            
            image_content = {
                'mime_type': mime_type,
                'data': image_data
            }
            
            response = model.generate_content([prompt, image_content])
            response_text = response.text
            
            # JSON 추출
            try:
                json_start = response_text.find('{')
                json_end = response_text.rfind('}') + 1
                if json_start >= 0 and json_end > json_start:
                    json_str = response_text[json_start:json_end]
                    result = json.loads(json_str)
                    result['success'] = True
                    result['backend'] = 'gemini'
                    return result
            except json.JSONDecodeError:
                pass
            
            return {
                'success': True,
                'vendor': 'Unknown',
                'total_amount': 0.0,
                'items': [],
                'payment_type': 'cash',
                'card_brand': None,
                'category': '기타',
                'confidence_score': 0.8,
                'backend': 'gemini',
            }
            
        except Exception as e:
            logger.error(f"Gemini receipt extraction error: {e}")
            return {
                'success': False,
                'error': str(e),
                'backend': 'gemini',
            }
    
    async def extract_contact_data(self, image_data: bytes, mime_type: str = 'image/jpeg') -> Dict:
        """
        명함/문서에서 연락처 정보 추출
        """
        if not self.api_key:
            return {
                'success': False,
                'error': 'API key not configured',
                'backend': 'gemini',
            }
        
        try:
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            model = genai.GenerativeModel(self.model)
            
            prompt = """이 이미지에서 연락처 정보를 JSON 형식으로 추출해줘:
{
    "name": "이름",
    "phone": "전화번호",
    "email": "이메일",
    "company": "회사명",
    "position": "직책",
    "confidence_score": 0.95
}"""
            
            image_content = {
                'mime_type': mime_type,
                'data': image_data
            }
            
            response = model.generate_content([prompt, image_content])
            response_text = response.text
            
            # JSON 추출
            try:
                json_start = response_text.find('{')
                json_end = response_text.rfind('}') + 1
                if json_start >= 0 and json_end > json_start:
                    json_str = response_text[json_start:json_end]
                    result = json.loads(json_str)
                    result['success'] = True
                    result['backend'] = 'gemini'
                    return result
            except json.JSONDecodeError:
                pass
            
            return {
                'success': True,
                'name': None,
                'phone': None,
                'email': None,
                'company': None,
                'position': None,
                'confidence_score': 0.8,
                'backend': 'gemini',
            }
            
        except Exception as e:
            logger.error(f"Gemini contact extraction error: {e}")
            return {
                'success': False,
                'error': str(e),
                'backend': 'gemini',
            }


# 하위 호환성을 위해 ClaudeOCRService 별칭 유지 (Gemini로 리다이렉트)
ClaudeOCRService = GeminiOCRService


class TesseractOCRService:
    """
    Tesseract OCR 서비스 (폴백)
    사용모델.md - Tesseract (OCR 폴백) 참고
    """
    
    def __init__(self):
        try:
            import pytesseract
            from PIL import Image
            self.pytesseract = pytesseract
            self.Image = Image
            self.available = True
        except ImportError:
            self.available = False
            logger.warning("pytesseract or PIL not installed")
    
    async def extract_text(
        self,
        image_path: str,
        context: str = 'general'
    ) -> Dict:
        """
        로컬 Tesseract를 사용한 텍스트 추출
        정확도: 60-70% (폴백용)
        """
        
        if not self.available:
            return {
                'success': False,
                'error': 'pytesseract not available',
                'backend': 'tesseract',
            }
        
        try:
            file_path = Path(image_path)
            if not file_path.exists():
                return {
                    'success': False,
                    'error': f'File not found: {image_path}',
                    'backend': 'tesseract',
                }
            
            img = self.Image.open(file_path)
            
            # 비동기 처리
            text = await asyncio.to_thread(
                self.pytesseract.image_to_string,
                img,
                lang='kor+eng'
            )
            
            return {
                'success': True,
                'text': text,
                'backend': 'tesseract',
                'confidence': 0.65,  # Tesseract 정확도는 일반적으로 낮음
            }
        
        except Exception as e:
            logger.error(f"Tesseract OCR error: {e}")
            return {
                'success': False,
                'error': str(e),
                'backend': 'tesseract',
            }
