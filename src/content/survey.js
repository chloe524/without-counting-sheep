import { arousalSurvey } from './arousal.js';
import { dbasSurvey } from './dbas.js';
import { moduleContent } from './modules.js';

// ISI와 PSQI의 구조와 채점 방식을 따르는 임시 문구다. 공식 한국어판 문항이 아니다.
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
// relaxCaution: 이완 실습 주의 안내, mental: 정신질환 안내 화면을 띄운다, pregnancy: 임신 중 수정 규칙(수면 창 6시간 이상, 30~60분 유연성)
export const safetyItems = [
  { id: 'selfHarm', text: '최근 2주 안에 죽고 싶다는 생각이나 자해 생각이 든 적이 있다', effect: 'stop', crisis: true },
  { id: 'bipolar', text: '양극성 장애(조울증) 진단을 받았거나 조증 삽화를 겪은 적이 있다', effect: 'stop', mental: true },
  { id: 'psychosis', text: '조현병 등 정신병적 장애로 진료를 받고 있거나 받은 적이 있다', effect: 'stop', mental: true },
  { id: 'seizure', text: '뇌전증(발작) 진단을 받았다', effect: 'stop' },
    { id: 'otherSleep', text: '코골이와 함께 숨이 멎는다는 말을 들었거나, 잠들 때 다리가 불편해 움직이고 싶은 느낌이 자주 있다', effect: 'stop' },
  { id: 'unstable', text: '최근 상태가 불안정한 신체·정신 질환이 있다', effect: 'stop' },
  { id: 'circadian', text: '교대근무를 하거나, 원하는 시간대와 몸의 수면 시간대가 크게 어긋나 있다', effect: 'stop' },
  { id: 'pregnant', text: '현재 임신 중이다', effect: 'pregnancy' },
  { id: 'driving', text: '운전이나 위험한 기계 조작을 일상적으로 한다', effect: 'noRestriction' },
  { id: 'falls', text: '최근 넘어진 적이 있거나, 일어설 때 어지럽거나, 혼자 이동하기 어렵다', effect: 'fallRisk' },
  { id: 'anxietyDep', text: '불안장애나 우울증으로 진료를 받고 있다', effect: 'relaxCaution', mental: true },
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

export const surveySources = {
  isi: {
    name: '불면증 심각도 척도(Insomnia Severity Index, ISI)',
    source: '출처: Morin CM (1993). 한국판: Cho YW et al. (2014), Journal of Clinical Neurology 10(3):210-215.',
  },
  psqi: {
    name: '한국판 피츠버그 수면의 질 지수(PSQI-K)',
    source: '출처: Buysse DJ et al. (1989), Psychiatry Research 28:193-213. 한국판: Sohn SI et al. (2012), Sleep and Breathing 16(3):803-812.',
  },
  first: {
    name: '포드 스트레스 불면 반응 검사(Ford Insomnia Response to Stress Test, FIRST)',
    source: '출처: Drake C et al. (2004), Sleep 27(2):285-291.',
  },
  draftNotice: '문항은 원 척도의 구조를 따른 연구용 임시 문구이며, 저작권자 허가를 받은 뒤 공식 문항으로 교체합니다.',
};

const frequencyScale = ['지난 한 달 동안 없었다', '한 주에 1번 미만', '한 주에 1~2번', '한 주에 3번 이상'];

// 지난 한 달 기준. 5번 문항은 a~j 순서다.
export const psqiItems = {
  disturbances: [
    '30분 안에 잠들 수 없었다',
    '한밤중이나 새벽에 깼다',
    '화장실에 가려고 일어나야 했다',
    '편하게 숨 쉴 수 없었다',
    '기침을 하거나 시끄럽게 코를 골았다',
    '너무 춥다고 느꼈다',
    '너무 덥다고 느꼈다',
    '나쁜 꿈을 꾸었다',
    '통증이 있었다',
    '그 밖의 이유로 잠들기 어려웠다',
  ],
  frequencyScale,
  quality: { id: 'q6', text: '지난 한 달 동안 전반적인 수면의 질은 어땠나요?', scale: ['매우 좋음', '상당히 좋음', '상당히 나쁨', '매우 나쁨'] },
  medication: { id: 'q7', text: '지난 한 달 동안 잠을 자려고 약(처방약, 일반약)을 얼마나 자주 먹었나요?', scale: frequencyScale },
  sleepiness: { id: 'q8', text: '지난 한 달 동안 운전, 식사, 사회 활동 중에 깨어 있기 어려웠던 적이 얼마나 자주 있었나요?', scale: frequencyScale },
  enthusiasm: { id: 'q9', text: '지난 한 달 동안 일을 해낼 의욕을 유지하는 것이 얼마나 문제가 되었나요?', scale: ['전혀 문제없음', '약간 문제', '어느 정도 문제', '매우 큰 문제'] },
};

export const firstItems = [
  '다음 날 중요한 회의나 미팅이 있을 때',
  '낮 동안 스트레스가 많은 일을 겪은 후',
  '저녁 시간에 스트레스가 많은 일을 겪은 후',
  '낮 동안 나쁜 소식을 전해 들은 후',
  '공포영화나 자극적인 TV 프로그램을 본 후',
  '직장(또는 학교)에서 기분 나쁜 하루를 보낸 후',
  '누군가와 말다툼이나 싸움을 벌인 후',
  '대중 앞에서 발표나 연설을 하기 전날 밤',
  '다음 날 휴가나 여행을 떠나기 전날 밤',
];
export const firstScale = ['전혀 그렇지 않다', '약간 그렇다', '꽤 그렇다', '매우 그렇다'];

export const trackInfo = {
  short: {
    title: '일시적 불면 또는 단기 불면에 가까워요',
    details: [
      '일시적인 불면증(Transient insomnia): 단지 며칠 동안 잠을 못 자는 것을 말합니다. 대개 흥분이나 스트레스가 원인입니다.',
      '단기성(급성) 불면증(Short-term insomnia): 스트레스가 지속될 때 2~3주 동안 잠을 제대로 못 자는 것입니다. 대개 스트레스가 없어지거나 적응이 되면 정상 수면을 회복합니다.',
    ],
    plan: 'CBT-I 6일치 플랜으로 진행합니다. 1, 2, 3주차에 각 2일씩, 총 6일입니다.',
  },
  long: {
    title: '만성 불면에 가까워요',
    details: ['수면 어려움이 3개월 이상, 일주일에 3번 이상 이어졌다고 답하셨습니다.'],
    plan: 'CBT-I 3주치 플랜으로 진행합니다. 먼저 기초 교육과 자극 조절을 약 1~2시간 진행한 뒤, 1, 2, 3주차 맞춤 플랜을 시작합니다.',
  },
  notice: '진단이 아니라 설문 응답에 따른 프로그램 분류입니다.',
};

// 임신 중 불면 안내. 본문은 연구자가 정리한 문헌 내용이다.
export const pregnancyInfo = {
  title: '임산부에게 일반적인 CBT-I를 그대로 적용할 수 없는 이유',
  body: [
    '임신 중 불면에는 표준 CBT-I를 그대로 적용하기 어렵습니다. 불면증 유병률은 3분기에 약 42.4%(1분기 25.3%, 2분기 27.2%)까지 늘고, 빈뇨(사구체여과율 약 50% 증가), 기능적 잔기용량 감소(9.5~25%), 수면무호흡(AHI 1분기 2.07에서 3분기 3.74), 하지불안증후군(22.9%), 위식도역류 같은 신체 요인이 임신 관련 정서적 고통과 과각성에 겹쳐 작용합니다. 이 중 수면무호흡과 하지불안증후군은 CBT-I만으로 다룰 수 없어 별도 평가가 필요합니다.',
    '표준 수면 제한 요법은 피로와 스트레스를 키울 수 있어 임신 중에는 적합하지 않을 수 있으므로, 수면 창을 6시간 미만으로 줄이지 않고 취침·기상 시간에 30~60분의 유연성을 두는 수정이 필요합니다.',
    '약물은 대안이지만 많은 임신부가 가능하면 약물을 피하려 하고, 졸피뎀 등 Z-약물의 1분기 노출은 주요 기형 위험을 높이지 않았으나(RR 1.01) 조산(OR 1.28)과 저체중아(OR 1.51) 위험은 소폭 높게 보고되었습니다(기저 질환에 의한 교란 가능성이 있습니다).',
    '비약물 치료인 CBT-I가 가능하면 1차로 권고되며, 임신 18~32주 여성 대상 시험에서 불면 중증도(ISI)가 CBT-I군 15.4에서 8.0으로, 대조군 15.9에서 11.2로 감소했습니다. 그럼에도 임신 중 CBT-I는 효과적이지만 활용이 적다고 평가되며, 해당 센터는 이 집단의 수면 장애를 따로 선별하지 않는다고 밝혔습니다. 따라서 임신부에게는 수정된 CBT-I를 안전 선별과 함께 접근 가능한 형태로 제공할 필요가 있습니다.',
  ],
  sitePolicy: {
    title: '이 웹사이트는 임신 중에도 안심하고 쓸 수 있도록 이렇게 바꿔 제공해요',
    points: [
      '수면 시간 조절은 일지를 7일 이상 쓴 뒤, 필요할 때만 시작해요.',
      '수면 시간은 6시간 미만으로 줄이지 않아요.',
      '취침·기상 시간은 30~60분 정도 여유 있게 지켜도 괜찮아요.',
      '코골이와 함께 숨이 멎거나 다리가 불편한 느낌(하지불안)이 있다고 답하면, 이 프로그램 대신 전문의 평가를 먼저 안내해요.',
      '약을 권하거나 바꾸지 않아요.',
    ],
    closing: '몸 상태가 평소와 다르거나 걱정되면 언제든 멈추고 담당 의사와 상의해 주세요.',
  },
};

// 정신질환이 있다고 답했을 때 보여 주는 안내. 진단이 아니라 참여 기준에 따른 안내다.
export const mentalHealthInfo = {
  priority: {
    title: '지금은 마음 건강 치료가 먼저예요',
    body: [
      '양극성 장애(조울증)나 조현병 같은 정신질환이 있으면, 잠 문제가 그 질환의 증상이거나 함께 나타나는 경우가 많아요. 그래서 불면만 따로 다루기보다 원래 질환을 먼저 치료하는 것이 우선이에요.',
      '특히 이 프로그램의 수면 시간 조절(수면 제한)은 잠을 일부러 줄이는 방법이라, 양극성 장애에서는 조증 삽화를 일으킬 수 있고 정신병적 증상도 나빠질 수 있어요. 그래서 전문가의 관리 없이 혼자 따라 하지 않도록 이 프로그램에는 참여하지 않게 했어요.',
    ],
    actions: [
      '진료를 받고 있다면, 담당 정신건강의학과 의사에게 잠 문제를 꼭 이야기해 주세요. 치료 계획 안에서 수면을 함께 다룰 수 있어요.',
      '진료를 받고 있지 않다면, 가까운 정신건강의학과나 지역 정신건강복지센터에서 상담을 받아 보세요.',
      '마음이 급하게 힘들어지면 정신건강위기상담전화 1577-0199(24시간)에 전화할 수 있어요.',
    ],
    closing: '이 안내는 진단이 아니에요. 이 결과로 어떤 불이익도 없어요.',
  },
  caution: {
    title: '치료 중인 마음 건강 문제가 있다면',
    body: [
      '불안장애나 우울증으로 진료를 받고 있다고 답하셨어요. 이 경우에도 불면 프로그램을 함께 쓸 수 있지만, 지금 받고 있는 치료가 먼저예요.',
    ],
    actions: [
      '이 프로그램을 시작한다고 담당 의사에게 알려 주세요. 약을 스스로 줄이거나 끊지 마세요.',
      '이완 연습 중에 오히려 불안해지면 바로 멈추세요.',
      '기분이나 불안이 눈에 띄게 나빠지면 프로그램을 멈추고 담당 의사와 상의해 주세요.',
    ],
    closing: '이 안내는 진단이 아니에요.',
  },
};

// 화면이 쓰는 설문 묶음. 서버와 시연판이 같은 내용을 내려보낸다.
export const surveyQuestions = () => ({
  isi: isiItems,
  duration: durationOptions,
  frequency: frequencyOptions,
  safety: safetyItems.map(({ id, text }) => ({ id, text })),
  sus: susItems,
  sources: surveySources,
  psqi: psqiItems,
  first: { items: firstItems, scale: firstScale },
  // 문항 메타데이터(tags)는 화면에 보내지 않는다.
  arousal: { ...arousalSurvey, subscales: arousalSurvey.subscales.map(({ tags, items, ...rest }) => ({ ...rest, items: items.map(({ tags: _, ...item }) => item) })) },
  dbas: dbasSurvey,
  modules: moduleContent,
  trackInfo,
  pregnancyInfo,
  mentalHealthInfo,
});
