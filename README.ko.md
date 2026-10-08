# Escher3D

[English](README.md) | **한국어**

Escher 대사경로 맵을 편집하고, 3차원 공간에서 반응 방향과 입력 플럭스를 탐색하는 로컬 웹 앱입니다.

![Escher3D](docs/escher3d.png)

## 실행

Node.js 18 이상이 필요합니다. 실행에 필요한 브라우저 라이브러리는 포함되어 있어 `npm install` 없이 실행합니다.

```bash
git clone https://github.com/hpend2373/escher3d.git
cd escher3d
npm start
```

브라우저에서 **http://127.0.0.1:4173/?map=merged** 를 엽니다. 서버 종료는 `Ctrl+C`입니다.

포트가 사용 중이면 다른 포트로 실행합니다.

```bash
node server.mjs --app-root app --port 4174 --open-path '/?map=merged'
```

macOS/Linux에서는 `./Escher-iMM1865.sh`, Windows에서는 `Escher-iMM1865.cmd`로도 실행할 수 있습니다. 이 런처는 사용 가능한 포트를 선택하고 브라우저를 엽니다.

## 주요 기능

- **2D 편집:** 기존 Escher 편집, 검색, 데이터 불러오기 및 내보내기.
- **3D 배치:** 원본 평면, 구획별 깊이, 단계별 경로, 방사형, 공간 분산.
- **정밀 최적화:** 현재 배치와 세 가지 추가 초기 배치를 비교하고, 연결 길이·반발력·중심 인력의 목적함수가 더 낮은 결과를 적용합니다. 진행률 및 취소를 지원하며 Web Worker에서 계산합니다.
- **경로 탐색:** 현재 맵 전체, 관심 항목 주변, 출발–도착 후보 경로. 공통 보조인자 및 0 플럭스 필터.
- **흐름 표시:** 방향 화살표와 이동 입자, 재생/정지, 속도와 공간 깊이 조절.
- **설정창 접기:** 상단 버튼으로 왼쪽 설정창을 접거나 펼쳐 3D 화면을 넓힙니다. 시연용 강조 안내는 모든 맵에 표시하며 예제가 아닌 맵에서는 예제 파일을 여는 방법을 안내합니다.
- **시연용 강조:** 예제 4개를 열면 발표용 관심 구간을 빨강·파랑 연결선과 화살표, 같은 색의 이동 입자와 짧은 잔상으로 강조하고 강조가 켜져 있는 동안 나머지 요소는 기존 불투명도의 60%로 표시합니다. 해당과정/TCA/PPP 예제의 TCA 진입 구간과 트립토판 예제의 멜라토닌 합성 구간에는 노란색 강조를 추가했습니다. 토글로 끌 수 있으며 실제 활성이나 생물학적 중요도를 의미하지 않습니다. PNG에도 시연용 안내가 남습니다.
- **저장:** 원본 맵 JSON, 현재 3D PNG, 최적화 좌표와 카메라를 포함한 별도 3D 보기 JSON.

## 공개 예제 경로 4개

앱에서 **기존 맵 JSON 불러오기**를 누르고 `examples/`의 파일을 선택합니다. 전체 맵을 3D로 변환하고 자동 최적화합니다.

| 예제 | 생물종 | 반응 수 | 고유 대사체 ID 수 |
|---|---|---:|---:|
| [해당과정·TCA·PPP](examples/RECON1.Glycolysis%20TCA%20PPP.json) | 사람 | 43 | 66 |
| [트립토판 대사](examples/RECON1.Tryptophan%20metabolism.json) | 사람 | 45 | 82 |
| [지방산 베타 산화](examples/iJO1366.Fatty%20acid%20beta-oxidation.json) | 대장균 | 46 | 59 |
| [포화 지방산 합성](examples/iJO1366.Fatty%20acid%20biosynthesis%20%28saturated%29.json) | 대장균 | 54 | 57 |

Escher 공식 서버에서 받은 원본입니다. 다운로드 URL과 SHA-256은 [examples/sources.json](examples/sources.json), 구조 검사 결과는 [examples/validation.json](examples/validation.json)에 있습니다. 예제는 사람 RECON1/대장균 iJO1366 기반이며 기본 마우스 iMM1865 모델과 별개입니다. 해당 종의 모델 기반 분석에는 맞는 모델을 사용하세요.

## 해석과 범위

기본 애니메이션은 **반응식 방향의 시각화**입니다. 측정 또는 계산된 세포 플럭스를 의미하지 않습니다. 단일 조건의 부호 있는 flux 값을 불러오고 플럭스 모드를 선택하면 음수는 역방향, 0·누락값은 정지합니다. 발현량이나 두 조건 비교값으로 플럭스를 추정하지 않습니다.

3D 좌표는 연결 구조를 읽기 위한 배치이며 실제 세포 내 위치가 아닙니다. 최적화는 여러 후보를 비교하는 휴리스틱으로, 전역 최적해나 모든 시점의 겹침 제거를 보장하지 않습니다. 경로 탐색은 현재 맵 범위이며 FBA, 동역학, 원자 추적을 수행하지 않습니다.

자동 3D 배치는 원본 2D 좌표를 덮어쓰지 않습니다. **3D 보기 저장**과 **맵 JSON 저장**은 서로 다른 파일입니다. Native Escher는 맵 로드 시 일부 빈 곡선 제어점을 보완할 수 있습니다.

## 검증

```bash
npm test
```

22개 검사: 반응 방향, signed flux, 이동/되돌리기, 경로 탐색, 단일 구획의 입체성, 원본 보존, 최적화 목적함수, 좌표 저장/복원 및 시연용 강조 대상과 원본 보존, 잔상의 방향과 경계 처리. 앱은 WebGL2가 필요하며 그래픽 초기화가 실패하면 2D 편집을 사용할 수 있습니다.

## 파일 구성

- `app/`: 로컬 브라우저 앱, 데이터, Escher 번들 및 Three.js.
- `app/escher-3d.js`, `app/escher-3d.css`: 3D 렌더링과 UI.
- `app/scene-data.js`, `app/graph-layout.js`: 맵 변환과 경로 탐색.
- `app/spatial-layout.js`, `app/spatial-worker.js`: 배치와 정밀 최적화.
- `examples/`: 공개 경로 4개와 출처/검증 기록.
- `server.mjs`: 기본 loopback 로컬 서버.
- `tests/`: Node.js 내장 테스트 러너 검사.

별도 번들링 단계 없이 확장 코드를 수정할 수 있습니다. `app/assets/`는 기존 Escher 편집기의 컴파일된 배포 자산으로 원래 번들을 보존합니다.

## 출처

[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)를 참고하세요. 기본 iMM1865 모델의 출처는 [docs/iMM1865-provenance.md](docs/iMM1865-provenance.md)에 기록했습니다. Framer 스타일 참고 문서는 `getdesign`으로 받은 [DESIGN.md](DESIGN.md)입니다.

## 원격 사용

기본 실행은 `127.0.0.1`에 바인딩합니다. `Escher-Remote.sh`/`.cmd`는 별도의 원격 실행 도구이며 접속 토큰을 생성합니다. 원격 HTTP 연결에는 TLS가 포함되지 않으므로 신뢰할 수 있는 사설망이나 SSH 터널에서 사용하세요. 생성된 접속 토큰은 저장소에 커밋하지 마세요.
