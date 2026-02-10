# KiroDesk 설치 가이드

## Windows

1. `KiroDesk Setup 1.0.0.exe` 다운로드
2. 실행하여 설치

또는 포터블 버전:
- `KiroDesk 1.0.0.exe` 다운로드 후 바로 실행

## Mac

### 설치 방법

1. `KiroDesk-1.0.0-mac.zip` 다운로드
2. 압축 해제
3. `KiroDesk.app`을 Applications 폴더로 이동

### "손상되었기 때문에 열 수 없습니다" 오류 해결

이 앱은 Apple Developer 서명이 없어서 보안 경고가 발생합니다.

**해결 방법 (터미널):**
```bash
xattr -cr /Applications/KiroDesk.app
```

**또는 (우클릭):**
1. `KiroDesk.app` 우클릭 → "열기"
2. "열기" 버튼 클릭

**또는 (시스템 설정):**
1. 앱 실행 시도 (오류 발생)
2. 시스템 설정 → 개인정보 보호 및 보안
3. "확인 없이 열기" 버튼 클릭

## 보안 안내

이 앱은 오픈소스이며 [GitHub 저장소](https://github.com/your-repo)에서 소스 코드를 확인할 수 있습니다.

Apple Developer Program 비용 문제로 코드 서명을 하지 않았습니다.
