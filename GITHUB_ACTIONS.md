# GitHub Actions 자동 빌드 가이드

## 설정 완료!

`.github/workflows/build.yml` 파일이 생성되었습니다.

## 사용 방법

### 방법 1: 태그로 릴리스 (자동 배포)

```bash
# 버전 태그 생성
git tag v1.0.0

# GitHub에 푸시
git push origin v1.0.0
```

자동으로:
1. Windows와 Mac에서 빌드 실행
2. GitHub Release 생성
3. 빌드 파일 자동 업로드

### 방법 2: 수동 실행 (테스트용)

1. GitHub 저장소 → Actions 탭
2. "Build and Release" 워크플로우 선택
3. "Run workflow" 버튼 클릭

빌드 파일은 Artifacts에 저장됨 (Release는 생성 안 됨)

## 생성되는 파일

### Windows
- `KiroDesk Setup 1.0.0.exe` - 설치 프로그램
- `KiroDesk 1.0.0.exe` - 포터블 버전

### Mac
- `KiroDesk-1.0.0.dmg` - DMG 설치 파일
- `KiroDesk-1.0.0-mac.zip` - ZIP 압축 파일
- Intel (x64) + Apple Silicon (arm64) 유니버설

## 첫 릴리스 만들기

```bash
# 1. 코드 커밋
git add .
git commit -m "Release v1.0.0"

# 2. 태그 생성
git tag v1.0.0

# 3. GitHub에 푸시
git push origin main
git push origin v1.0.0

# 4. GitHub에서 자동 빌드 시작
# 5. 완료되면 Release 페이지에서 다운로드 가능
```

## 버전 업데이트

1. `package.json`의 `version` 수정
2. 새 태그로 릴리스:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```

## 코드 서명 (선택사항)

### Mac 코드 서명
GitHub Secrets에 추가:
- `CSC_LINK`: p12 인증서 (base64)
- `CSC_KEY_PASSWORD`: 인증서 비밀번호

### Windows 코드 서명
GitHub Secrets에 추가:
- `WIN_CSC_LINK`: pfx 인증서 (base64)
- `WIN_CSC_KEY_PASSWORD`: 인증서 비밀번호

현재는 코드 서명 없이 빌드됨 (`CSC_IDENTITY_AUTO_DISCOVERY: false`)

## 빌드 시간

- 각 플랫폼당 약 5-10분
- 병렬 실행으로 총 10분 내외

## 비용

- Public 저장소: 무료
- Private 저장소: 월 2,000분 무료 (초과 시 유료)

## 문제 해결

### 빌드 실패 시
1. GitHub Actions 탭에서 로그 확인
2. 로컬에서 `npm run package` 테스트
3. 의존성 문제: `npm ci` 재실행

### Release 생성 안 됨
- 태그가 `v`로 시작하는지 확인 (예: `v1.0.0`)
- `GITHUB_TOKEN` 권한 확인 (자동 제공됨)
