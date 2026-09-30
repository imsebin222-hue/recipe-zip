# Recipe Zip

YouTube 요리 영상의 자막을 OpenRouter를 통해 구조화해 레시피 화면으로 보여주는 작은 웹 앱입니다.

## 안전한 시작 방법

1. 방금 노출된 API 키는 각 서비스 콘솔에서 폐기하고 새 키를 발급합니다.
2. `.env.example`을 복사해 이름을 `.env`로 바꾸고, 새 키를 해당 파일에만 입력합니다.
3. YouTube API 키에는 서버 IP 제한(배포 전) 또는 개발용 로컬 환경 제한을 설정합니다.
4. OpenRouter에서 사용할 모델의 잔액과 사용 한도를 먼저 확인합니다.
5. `npm install` 후 `npm run dev`를 실행하고 `http://localhost:3000`을 엽니다.

`.env`는 `.gitignore`에 포함되어 있어 Git에 올라가지 않습니다. API 키는 `index.html`이나 `script.js`에 넣지 마세요.

## 휴대폰에서 열기

컴퓨터와 휴대폰을 같은 Wi-Fi에 연결한 뒤, 컴퓨터의 로컬 IP에 포트 `3000`을 붙여 접속합니다. 예: `http://192.168.0.10:3000`.
이 앱은 로컬 네트워크에서만 열리며, API 키는 계속 컴퓨터의 `.env` 파일에만 남습니다.

## 현재 연결 구조

`브라우저 → /api/recipes (서버) → YouTube Data API + 자막 추출 → OpenRouter → 구조화된 레시피 JSON → 화면`

자막이 비활성화되었거나 추출 서비스가 막은 영상은 레시피를 만들 수 없습니다. 이 경우 다른 자막 제공 경로 또는 영상 소유자의 권한 연동이 필요합니다.

## 공개 배포 (GitHub + Render)

이 앱은 `/api/recipes`를 제공하는 Node 서버가 필요하므로 GitHub Pages만으로는 동작하지 않습니다. 저장소를 GitHub에 올린 뒤 Render에서 **New → Blueprint**로 저장소를 연결하면 `render.yaml` 설정으로 웹 서비스를 만들 수 있습니다. 배포 완료 후 Render가 제공하는 `https://…onrender.com` 주소를 공유하면 누구나 접속할 수 있습니다.

Blueprint 생성 중 `YOUTUBE_API_KEY`와 `OPENROUTER_API_KEY`를 입력하세요. 두 키는 Render의 환경 변수로만 저장하고 GitHub에는 올리지 마세요. 로컬 `.env` 파일도 커밋하지 않습니다. Render는 이 서비스를 외부에 공개하므로 공유 링크를 가진 누구나 API를 호출할 수 있고, API 사용량은 설정한 키의 계정에 청구됩니다. 각 서비스 콘솔에서 사용량 한도와 키 제한을 설정하세요.

Render 무료 플랜은 유휴 상태 후 잠들 수 있어 첫 요청이 늦어질 수 있습니다. [Render Blueprint 문서](https://render.com/docs/blueprint-spec)
