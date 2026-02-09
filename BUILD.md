# KiroDesk 빌드 가이드

## 빌드 방법

### Windows용 빌드
```bash
npm run package:win
```

생성되는 파일:
- `release/KiroDesk Setup 1.0.0.exe` - 설치 프로그램
- `release/KiroDesk 1.0.0.exe` - 포터블 버전

### Mac용 빌드
```bash
npm run package:mac
```

생성되는 파일:
- `release/KiroDesk-1.0.0-mac.zip` - ZIP 압축 파일 (Intel x64 + Apple Silicon arm64)

**Windows에서 Mac용 빌드 시 주의사항:**
- ZIP 파일만 생성됨 (DMG 불가)
- 코드 서명 없음 → Mac 사용자가 보안 경고 받음
- Mac 사용자는 다운로드 후: 우클릭 → 열기 → 확인

### 모든 플랫폼 빌드 (Windows에서)
```bash
npm run package
```

Windows + Mac ZIP 모두 생성

## 빌드 전 준비사항

1. **의존성 설치**
   ```bash
   npm install
   ```

2. **node-pty 빌드 도구 (Windows)**
   - Visual Studio Build Tools 설치 필요
   - 또는 `npm install --global windows-build-tools`

3. **코드 서명 (선택사항)**
   - Mac: Apple Developer 인증서 필요 (Mac에서만 가능)
   - Windows: Code Signing 인증서 필요

## 프로덕션 배포 권장사항

### Mac DMG 생성 (Mac에서만)
Mac에서 제대로 된 DMG + 코드 서명을 하려면:

1. Mac에서 `package.json` 수정:
```json
"mac": {
  "target": [
    { "target": "dmg", "arch": ["x64", "arm64"] },
    { "target": "zip", "arch": ["x64", "arm64"] }
  ]
}
```

2. 빌드:
```bash
npm run package:mac
```

### 권장 워크플로우
- **개발/테스트**: Windows에서 모든 플랫폼 ZIP 생성
- **프로덕션**: 각 플랫폼에서 해당 플랫폼용 빌드 (코드 서명 포함)

## 빌드 설정

`package.json`의 `build` 섹션에서 설정 변경 가능:

- `appId`: 앱 식별자
- `productName`: 제품 이름
- `mac.target`: Mac 빌드 타겟
- `win.target`: Windows 빌드 타겟

## 문제 해결

### node-pty 빌드 실패
```bash
npm rebuild node-pty
```

### asar 압축 문제
`asarUnpack`에 네이티브 모듈 경로 추가됨 (node-pty)

### Mac 보안 경고
코드 서명 없는 앱은 Mac에서:
1. 다운로드 후 우클릭 → 열기
2. 또는 시스템 설정 → 개인정보 보호 및 보안 → 확인

