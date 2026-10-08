# 공개 Escher 예제 맵 4개

Escher 공식 배포 서버에서 다운로드한 원본 JSON입니다. 6개 후보 중 반응 수가 적은 4개를 선정했습니다. 경로를 잘라내거나 맵 좌표를 수정하지 않았습니다.

현재 앱에서 **기존 맵 JSON 불러오기**로 원하는 파일을 선택하면 3D로 변환·최적화됩니다. **3D 보기 열기**는 저장된 3D 설정용이므로 원본 맵은 위 불러오기 버튼을 사용하세요.

| 맵 | 생물종 | 맵 반응 수 | 고유 대사체 ID 수 |
|---|---|---:|---:|
| [사람 해당과정·TCA·PPP](RECON1.Glycolysis%20TCA%20PPP.json) | Homo sapiens | 43 | 66 |
| [사람 트립토판 대사](RECON1.Tryptophan%20metabolism.json) | Homo sapiens | 45 | 82 |
| [대장균 지방산 베타 산화](iJO1366.Fatty%20acid%20beta-oxidation.json) | Escherichia coli | 46 | 59 |
| [대장균 포화 지방산 합성](iJO1366.Fatty%20acid%20biosynthesis%20(saturated).json) | Escherichia coli | 54 | 57 |

사람 RECON1 및 대장균 iJO1366 기반 맵으로, 현재 기본 마우스 iMM1865 모델과는 별개입니다. 맵의 3D 시각화에 사용할 수 있지만 종 간 비교나 모델 기반 분석 시 해당 원본 모델을 별도로 사용해야 합니다. 기본 애니메이션은 맵에 기재된 반응 방향의 표시이며 측정된 플럭스가 아닙니다.

## 출처

공식 목록: https://escher.github.io/1-0-0/6/index.json

- RECON1.Glycolysis TCA PPP: https://escher.github.io/1-0-0/6/maps/Homo%20sapiens/RECON1.Glycolysis%20TCA%20PPP.json
- RECON1.Tryptophan metabolism: https://escher.github.io/1-0-0/6/maps/Homo%20sapiens/RECON1.Tryptophan%20metabolism.json
- iJO1366.Fatty acid beta-oxidation: https://escher.github.io/1-0-0/6/maps/Escherichia%20coli/iJO1366.Fatty%20acid%20beta-oxidation.json
- iJO1366.Fatty acid biosynthesis (saturated): https://escher.github.io/1-0-0/6/maps/Escherichia%20coli/iJO1366.Fatty%20acid%20biosynthesis%20%28saturated%29.json

다운로드 시각, 원본 URL, SHA-256은 sources.json에 기록했습니다. 구조 검사는 validation.json을 참고하세요.
