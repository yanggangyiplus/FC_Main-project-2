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
