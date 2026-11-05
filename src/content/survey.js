// ISI(Morin) 구조(7문항, 0~4점)를 따르는 임시 문구다. 공식 한국어판이 아니다.
// 저작권자 허가를 받은 뒤 공식 문항으로 교체하고 study.isiLicenseConfirmed를 true로 바꾼다.
const severity = ['없음', '약간', '보통', '심함', '매우 심함'];

export const isiItems = [
  { id: 'isi1', text: '최근 2주 동안, 잠들기 어려웠던 정도는 어땠나요?', scale: severity },
  { id: 'isi2', text: '최근 2주 동안, 자다가 깨서 다시 잠들기 어려웠던 정도는 어땠나요?', scale: severity },
  { id: 'isi3', text: '최근 2주 동안, 원하는 시간보다 너무 일찍 깨는 문제는 어땠나요?', scale: severity },
  { id: 'isi4', text: '지금 수면 패턴에 얼마나 만족하나요?', scale: ['매우 만족', '만족', '보통', '불만족', '매우 불만족'] },
  { id: 'isi5', text: '수면 문제가 낮 시간 활동(피로, 집중, 기억, 기분 등)을 얼마나 방해하나요?', scale: ['전혀 아님', '약간', '어느 정도', '많이', '매우 많이'] },
  { id: 'isi6', text: '수면 문제로 삶의 질이 떨어진 것이 다른 사람 눈에 얼마나 띈다고 생각하나요?', scale: ['전혀 아님', '약간', '어느 정도', '많이', '매우 많이'] },
  { id: 'isi7', text: '지금 수면 문제가 얼마나 걱정되나요?', scale: ['전혀 아님', '약간', '어느 정도', '많이', '매우 많이'] },
];

export const durationOptions = [
  { value: 'days', label: '며칠 정도 (2주 미만)' },
  { value: 'weeks', label: '2주 이상 3개월 미만' },
  { value: 'months', label: '3개월 이상' },
];

export const frequencyOptions = [
  { value: 'low', label: '일주일에 2번 이하' },
  { value: 'high', label: '일주일에 3번 이상' },
];

// 항목은 연구자 초안이며 study.safetyItemsConfirmed로 확정 여부를 관리한다.
// stop: 참여 불가(상담 안내), noRestriction: 수면 시간 조절 제외, fallRisk: 밤에 일어나 이동하는 안내 제외,
// relaxCaution: 이완 실습 주의 안내
export const safetyItems = [
  { id: 'selfHarm', text: '최근 2주 안에 죽고 싶다는 생각이나 자해 생각이 든 적이 있다', effect: 'stop', crisis: true },
  { id: 'bipolar', text: '양극성 장애(조울증) 진단을 받았거나 조증 삽화를 겪은 적이 있다', effect: 'stop' },
  { id: 'psychosis', text: '조현병 등 정신병적 장애로 진료를 받고 있거나 받은 적이 있다', effect: 'stop' },
  { id: 'seizure', text: '뇌전증(발작) 진단을 받았다', effect: 'stop' },
    { id: 'otherSleep', text: '코골이와 함께 숨이 멎는다는 말을 들었거나, 잠들 때 다리가 불편해 움직이고 싶은 느낌이 자주 있다', effect: 'stop' },
  { id: 'unstable', text: '최근 상태가 불안정한 신체·정신 질환이 있다', effect: 'stop' },
  { id: 'circadian', text: '교대근무를 하거나, 원하는 시간대와 몸의 수면 시간대가 크게 어긋나 있다', effect: 'stop' },
  { id: 'pregnant', text: '현재 임신 중이다', effect: 'noRestriction' },
  { id: 'driving', text: '운전이나 위험한 기계 조작을 일상적으로 한다', effect: 'noRestriction' },
  { id: 'falls', text: '최근 넘어진 적이 있거나, 일어설 때 어지럽거나, 혼자 이동하기 어렵다', effect: 'fallRisk' },
  { id: 'anxietyDep', text: '불안장애나 우울증으로 진료를 받고 있다', effect: 'relaxCaution' },
];

// System Usability Scale. 홀수 문항은 긍정, 짝수 문항은 부정 문장이다.
export const susItems = [
  '이 웹사이트를 자주 사용하고 싶다.',
  '이 웹사이트는 불필요하게 복잡하다.',
  '이 웹사이트는 사용하기 쉬웠다.',
  '이 웹사이트를 쓰려면 다른 사람의 도움이 필요할 것 같다.',
  '이 웹사이트의 기능들이 잘 어우러져 있다.',
  '이 웹사이트에는 앞뒤가 맞지 않는 부분이 많다.',
  '대부분의 사람이 이 웹사이트를 금방 익힐 것 같다.',
  '이 웹사이트는 사용하기 번거로웠다.',
  '이 웹사이트를 쓰면서 자신감이 있었다.',
  '이 웹사이트를 쓰기 전에 배워야 할 것이 많았다.',
];
