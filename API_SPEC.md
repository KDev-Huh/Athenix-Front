# SoccerMove API 명세서 (프론트 연동 기준)

- 버전: v1
- Base URL: `/api/v1`
- 인증: `Authorization: Bearer <accessToken>`
- 기본 Content-Type: `application/json`
- 파일 업로드 Content-Type: `multipart/form-data`

## 1) 공통 규칙

### 1.1 성공 응답

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

### 1.2 오류 응답

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "MATCH_NOT_FOUND",
    "message": "경기를 찾을 수 없습니다."
  }
}
```

### 1.3 식별자 정책

- 모든 식별자(`user.id`, `match.id`, `memo.id`, `feedback.id`, `tip.id`)는 DB `AUTO_INCREMENT` 기반 정수형을 사용합니다.
- Path Parameter인 `matchId`, `memoId`, `feedbackId`도 모두 정수형입니다.

### 1.4 프론트 상태값 호환 정책 (중요)

현재 프론트는 경기 상태를 아래 한글 문자열로 직접 비교합니다.

- `임시 저장`
- `분석 중`
- `분석 완료`

따라서 경기 API 응답의 `status`는 위 문자열 그대로 내려야 화면 수정 없이 바로 동작합니다.

---

## 2) 화면별 실제 필요 데이터

### 2.1 로그인/회원가입 화면

- 로그인 요청값: `email`, `password`
- 회원가입 요청값: `name`, `position`, `email`, `password`
- 실패 시 프론트는 에러 문구를 즉시 표시하므로 `error.message`가 필요합니다.

### 2.2 홈 화면

- 최근 경기 카드(최대 3개): `id`, `date`, `title`, `description`
- 최근 메모 카드(최대 2개): `id`, `matchId`, `label`, `text`, `time`
- 오늘의 팁: `id`, `title`, `content`

### 2.3 경기 목록 화면

- 경기 목록: `id`, `title`, `date`, `description`, `status`, `createdAt`
- 상태 변경 드롭다운 동작을 위해 `PATCH /matches/{matchId}/status`가 필요합니다.

### 2.4 경기 업로드 화면

업로드 시 실제 입력/전달 값:

- `file` (필수)
- `title` (필수, 파일명 자동 입력 후 사용자 수정 가능)
- `date` (필수)
- `description` (선택)
- `opponentName` (선택)
- `teamName` (선택)
- `position` (선택)
- `jerseyNumber` (선택)

### 2.5 분석 화면

- 선택 경기 정보: `id`, `title`, `date`
- 영상 재생: 스트리밍 가능 URL 또는 binary stream
- 경기별 메모: `id`, `matchId`, `time(mm:ss)`, `text`, `label`, `createdAt`
- 메모 선택 시 `time` 기준 시킹
- 메모 수정/삭제는 선택된 메모 카드에서 동작
- AI 피드백 결과: `feedbackId`, `situation`, `movement`, `createdAt`

---

## 3) 인증 API

### 3.1 회원가입
- Method/Path: `POST /auth/signup`
- Auth: 불필요
- Request Body:

```json
{
  "name": "홍길동",
  "position": "윙어",
  "email": "player@soccermove.ai",
  "password": "password123"
}
```

- Response: `201 Created`

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "name": "홍길동",
      "position": "윙어",
      "email": "player@soccermove.ai"
    }
  },
  "error": null
}
```

### 3.2 로그인
- Method/Path: `POST /auth/login`
- Auth: 불필요
- Request Body:

```json
{
  "email": "player@soccermove.ai",
  "password": "password123"
}
```

- Response: `200 OK`

```json
{
  "success": true,
  "data": {
    "accessToken": "...",
    "refreshToken": "...",
    "session": {
      "userId": 1,
      "name": "홍길동",
      "email": "player@soccermove.ai",
      "loggedInAt": "2026-04-20T09:00:00Z"
    }
  },
  "error": null
}
```

### 3.3 로그아웃
- Method/Path: `POST /auth/logout`
- Auth: 필요
- Request Headers:
  - `Authorization: Bearer <accessToken>`
- Request Body: 없음
- Response: `200 OK`

```json
{
  "success": true,
  "data": {
    "message": "로그아웃 되었습니다."
  },
  "error": null
}
```

### 3.4 토큰 갱신
- Method/Path: `POST /auth/refresh`
- Auth: refresh token
- Request Headers:
  - `Authorization: Bearer <refreshToken>`
- Request Body: 없음
- Response: `200 OK`

```json
{
  "success": true,
  "data": {
    "accessToken": "...",
    "refreshToken": "...",
    "expiresIn": 3600
  },
  "error": null
}
```

---

## 4) 경기 API

### 4.1 경기 목록 조회 (임시 저장 포함)
- Method/Path: `GET /matches`
- Auth: 필요
- Query:
  - `status` (optional): `임시 저장|분석 중|분석 완료`
  - `sort` (optional): `latest|oldest`
  - `page`, `size` (optional)

- Response item:

```json
{
  "id": 1,
  "title": "부산고 vs 서울",
  "date": "2026-04-03",
  "description": "전방 압박 전환 장면",
  "status": "분석 중",
  "thumbnailUrl": "/api/v1/thumbnails/e10f46f9-f8dd-48a2-b8b9-6102e25f5d10.jpg",
  "createdAt": "2026-04-19T10:10:00Z"
}
```

- `thumbnailUrl`은 경기 썸네일 접근 경로이며 항상 `/api/v1/thumbnails/{filename}` 형식으로 제공합니다.

### 4.2 최근 경기 조회 (홈 전용 추가)
- Method/Path: `GET /matches/recent`
- Auth: 필요
- Query:
  - `limit` (default: `3`)

- Response item 필드는 4.1 경기 목록 조회 item과 동일하며 `thumbnailUrl`을 포함합니다.

### 4.3 경기 단건 조회
- Method/Path: `GET /matches/{matchId}`
- Auth: 필요
- Path Params:
  - `matchId` (integer)
- Request Body: 없음
- Response: `200 OK`

```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "부산고 vs 서울",
    "date": "2026-04-03",
    "description": "전방 압박 전환 장면",
    "status": "분석 중",
    "opponentName": "블루웨이브",
    "teamName": "중원유나이티드",
    "position": "윙어",
    "jerseyNumber": "11",
    "createdAt": "2026-04-19T10:10:00Z",
    "updatedAt": "2026-04-20T09:00:00Z"
  },
  "error": null
}
```

### 4.4 경기 업로드
- Method/Path: `POST /matches`
- Auth: 필요
- Content-Type: `multipart/form-data`
- Form fields:
  - `file` (필수)
  - `title` (필수)
  - `date` (필수)
  - `description` (선택)
  - `opponentName` (선택)
  - `teamName` (선택)
  - `position` (선택)
  - `jerseyNumber` (선택)

- Response: `201 Created`

### 4.5 경기 상태 변경
- Method/Path: `PATCH /matches/{matchId}/status`
- Auth: 필요
- Request Body:

```json
{
  "status": "분석 완료"
}
```

### 4.6 경기 삭제
- Method/Path: `DELETE /matches/{matchId}`
- Auth: 필요
- 정책: 경기 삭제 시 해당 경기 영상/메모/AI 피드백도 cascade 삭제

### 4.7 경기 썸네일 조회
- Method/Path: `GET /thumbnails/{filename}`
- Auth: 필요
- Path Params:
  - `filename` (string)
- 설명:
  - 경기 목록/최근 경기 응답의 `thumbnailUrl` 필드는 `/api/v1/thumbnails/{filename}` 형식을 사용합니다.
  - 프론트는 해당 URL을 이미지 `src`로 직접 사용하면 됩니다.

---

## 5) 경기 영상 API

### 5.1 경기 영상 스트리밍 조회
- Method/Path: `GET /matches/{matchId}/video`
- Auth: 필요
- 요구사항:
  - `Range` 헤더 지원
  - `Accept-Ranges: bytes`
  - `206 Partial Content` 지원

### 5.2 경기 영상 메타 조회
- Method/Path: `GET /matches/{matchId}/video/meta`
- Auth: 필요
- Response:

```json
{
  "durationSec": 5420,
  "codec": "h264",
  "sizeBytes": 734003200,
  "thumbnailUrl": "https://..."
}
```

---

## 6) 메모 API

### 6.0 메모 응답 객체 형식

```json
{
  "id": 101,
  "matchId": 1,
  "timeMs": 754321,
  "timeLabel": "12:34.321",
  "label": "메모",
  "text": "압박 타이밍이 늦음",
  "createdAt": "2026-04-20T09:20:00Z",
  "updatedAt": "2026-04-20T09:20:00Z"
}
```

- `timeMs`: 서버 내부 저장/시킹 기준 밀리초 정수
- `timeLabel`: 화면 표시용 문자열(`mm:ss.SSS`)

### 6.1 전체 메모 조회
- Method/Path: `GET /memos`
- Auth: 필요
- Query:
  - `page`, `size`
  - `sort=latest|oldest`
- Response: `200 OK`

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 101,
        "matchId": 1,
        "timeMs": 754321,
        "timeLabel": "12:34.321",
        "label": "메모",
        "text": "압박 타이밍이 늦음",
        "createdAt": "2026-04-20T09:20:00Z",
        "updatedAt": "2026-04-20T09:20:00Z"
      }
    ],
    "page": 1,
    "size": 20,
    "total": 37
  },
  "error": null
}
```

### 6.2 최근 메모 조회 (홈 전용 추가)
- Method/Path: `GET /memos/recent`
- Auth: 필요
- Query:
  - `limit` (default: `2`)
- Response: `200 OK`

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 201,
        "matchId": 3,
        "timeMs": 492210,
        "timeLabel": "08:12.210",
        "label": "AI 피드백",
        "text": "왼쪽 유인 후 중앙 침투를 추천합니다.",
        "createdAt": "2026-04-20T09:25:00Z",
        "updatedAt": "2026-04-20T09:25:00Z"
      }
    ]
  },
  "error": null
}
```

### 6.3 경기별 메모 조회
- Method/Path: `GET /matches/{matchId}/memos`
- Auth: 필요
- Path Params:
  - `matchId` (integer)
- Response: `200 OK`

```json
{
  "success": true,
  "data": {
    "matchId": 1,
    "items": [
      {
        "id": 101,
        "matchId": 1,
        "timeMs": 754321,
        "timeLabel": "12:34.321",
        "label": "메모",
        "text": "압박 타이밍이 늦음",
        "createdAt": "2026-04-20T09:20:00Z",
        "updatedAt": "2026-04-20T09:20:00Z"
      }
    ]
  },
  "error": null
}
```

### 6.4 메모 추가
- Method/Path: `POST /matches/{matchId}/memos`
- Auth: 필요
- Path Params:
  - `matchId` (integer)
- Request Body:

```json
{
  "text": "압박 타이밍이 늦음",
  "timeMs": 754321,
  "label": "메모"
}
```

- Response: `201 Created`

```json
{
  "success": true,
  "data": {
    "id": 301,
    "matchId": 1,
    "timeMs": 754321,
    "timeLabel": "12:34.321",
    "label": "메모",
    "text": "압박 타이밍이 늦음",
    "createdAt": "2026-04-20T09:30:00Z",
    "updatedAt": "2026-04-20T09:30:00Z"
  },
  "error": null
}
```

### 6.5 메모 수정
- Method/Path: `PATCH /memos/{memoId}`
- Auth: 필요
- Path Params:
  - `memoId` (integer)
- Request Body:

```json
{
  "text": "수정된 메모 내용"
}
```

- Response: `200 OK`

```json
{
  "success": true,
  "data": {
    "id": 301,
    "matchId": 1,
    "timeMs": 754321,
    "timeLabel": "12:34.321",
    "label": "메모",
    "text": "수정된 메모 내용",
    "createdAt": "2026-04-20T09:30:00Z",
    "updatedAt": "2026-04-20T09:35:00Z"
  },
  "error": null
}
```

### 6.6 메모 삭제
- Method/Path: `DELETE /memos/{memoId}`
- Auth: 필요
- Path Params:
  - `memoId` (integer)
- Response: `200 OK`

```json
{
  "success": true,
  "data": {
    "deleted": true,
    "memoId": 301
  },
  "error": null
}
```

---

## 7) AI 피드백 API

### 7.1 AI 피드백 생성
- Method/Path: `POST /matches/{matchId}/ai-feedback`
- Auth: 필요
- Request Body:

```json
{
  "timeMs": 754321,
  "context": "선수 움직임 분석 요청"
}
```

- Response:

```json
{
  "success": true,
  "data": {
    "feedbackId": 1,
    "timeMs": 754321,
    "timeLabel": "12:34.321",
    "situation": "수비 라인이 좁아졌습니다.",
    "playGuide": {
      "type": "PASS",
      "start_x": 42.1,
      "start_y": 58.3,
      "end_x": 71.8,
      "end_y": 44.6,
      "message": "수비를 끌어낸 뒤 오른쪽 하프스페이스로 스루패스를 시도하세요."
    },
    "createdAt": "2026-04-20T09:10:00Z"
  },
  "error": null
}
```

- `playGuide.type` enum:
  - `PASS` (패스)
  - `DRIBBLE` (드리블)
  - `SHOT` (슈팅)
- 좌표계:
  - `start_x`, `start_y`, `end_x`, `end_y`는 `0~100` 정규화 좌표를 사용합니다.

### 7.2 AI 피드백 이력 조회
- Method/Path: `GET /matches/{matchId}/ai-feedback`
- Auth: 필요
- Path Params:
  - `matchId` (integer)
- Query (optional):
  - `page`, `size`
  - `sort=latest|oldest`
- Response: `200 OK`

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "feedbackId": 1,
        "matchId": 1,
        "timeMs": 754321,
        "timeLabel": "12:34.321",
        "situation": "수비 라인이 좁아졌습니다.",
        "playGuide": {
          "type": "PASS",
          "start_x": 42.1,
          "start_y": 58.3,
          "end_x": 71.8,
          "end_y": 44.6,
          "message": "수비를 끌어낸 뒤 오른쪽 하프스페이스로 스루패스를 시도하세요."
        },
        "createdAt": "2026-04-20T09:10:00Z"
      }
    ],
    "page": 1,
    "size": 20,
    "total": 12
  },
  "error": null
}
```

### 7.3 AI 피드백을 메모로 추가
- Method/Path: `POST /matches/{matchId}/ai-feedback/memo`
- Auth: 필요
- Request Body:

```json
{
  "feedbackId": 1,
  "label": "AI 피드백"
}
```

- Response: `201 Created`

```json
{
  "success": true,
  "data": {
    "id": 401,
    "matchId": 1,
    "timeMs": 754321,
    "timeLabel": "12:34.321",
    "label": "AI 피드백",
    "text": "[AI 피드백] 왼쪽 유인 후 중앙 침투를 추천합니다.",
    "sourceFeedbackId": 1,
    "createdAt": "2026-04-20T09:12:00Z",
    "updatedAt": "2026-04-20T09:12:00Z"
  },
  "error": null
}
```

---

## 8) 오늘의 팁 API

### 8.1 오늘의 팁 조회
- Method/Path: `GET /tips/today`
- Auth: 필요
- Response:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "오늘의 팁",
    "content": "압박 전환 시 2선 간격 유지",
    "updatedAt": "2026-04-20T00:00:00Z"
  },
  "error": null
}
```

---

## 9) 구현 비고

- 메모/AI 피드백 시간은 저장 시 내부적으로 `timeMs` 정수로 저장하고, 응답에는 `timeLabel(mm:ss.SSS)`도 함께 제공하는 것을 권장합니다.
- `POST /matches`, `POST /matches/{matchId}/memos`, `POST /matches/{matchId}/ai-feedback`에는 `Idempotency-Key` 헤더 지원을 권장합니다.
- 프론트 무수정 연동을 위해 경기 상태 문자열은 현재 한글 값(`임시 저장`, `분석 중`, `분석 완료`)을 그대로 유지해야 합니다.
