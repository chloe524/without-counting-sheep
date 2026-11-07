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

// 과각성 문항은 검증된 척도가 아니라 연구자 초안이다. 대뇌피질 과각성은 뇌파 측정이 필요해 설문으로 재지 않는다.
export const arousalScale = ['전혀 아니다', '약간 그렇다', '꽤 그렇다', '매우 그렇다'];
export const arousalDomains = [
  {
    id: 'somatic',
    name: '생리적(신체적) 과각성',
    description: '심박수, 근육 긴장, 호흡 등 몸의 각성 상태가 높아진 상태입니다.',
    items: ['잠자리에 누우면 심장이 빠르게 뛰는 느낌이 든다', '잠자리에 누우면 몸이나 근육이 긴장되어 있다', '잠들기 전 숨이 가쁘거나 몸이 들뜬 느낌이 있다'],
  },
  {
    id: 'psychological',
    name: '심리적 과각성',
    description: '수면에 대한 불안, 스트레스, 정서적 긴장이 높아진 상태입니다.',
    items: ['오늘 잘 잘 수 있을지 불안하다', '잠을 못 자면 다음 날 어떻게 될지 걱정된다', '스트레스나 정서적 긴장이 잠자리까지 이어진다'],
  },
  {
    id: 'cognitive',
    name: '인지적 과각성',
    description: '잠들기 전 생각과 정신적 활동이 과도하게 이어지는 상태입니다.',
    items: ['잠들기 전 생각이 멈추지 않는다', '같은 생각을 반복해서 곱씹는다', '생각을 억지로 하지 않으려고 애쓴다'],
  },
];
export const corticalArousalNote = '대뇌피질 과각성은 뇌파(EEG) 측정이 필요해 이 설문으로는 측정하지 않습니다.';

// 수면에 대한 믿음과 태도(DBAS, Morin) 연구에서 다루는 주제를 참고한 연구자 초안이다.
export const beliefItems = [
  { id: 'eightHours', text: '누구나 반드시 8시간은 자야 한다' },
  { id: 'catchUp', text: '잠을 못 잔 날은 다음 날 늦잠이나 낮잠으로 꼭 보충해야 한다' },
  { id: 'earlyBed', text: '잠이 안 와도 일찍 침대에 누워 있으면 도움이 된다' },
  { id: 'stayInBed', text: '잠이 안 와도 침대에 계속 누워 있어야 쉬는 것이다' },
  { id: 'oneBadNight', text: '하룻밤 잠을 설치면 다음 날을 완전히 망친다' },
  { id: 'healthRuin', text: '불면이 계속되면 건강이 심각하게 망가질 수밖에 없다' },
  { id: 'cantControl', text: '잠은 내가 어떻게 할 수 없는 일이다' },
  { id: 'tryHarder', text: '더 애쓰면 잠들 수 있다' },
  { id: 'medicineOnly', text: '불면은 약을 먹어야만 해결된다' },
  { id: 'alcohol', text: '술을 마시면 잠을 더 잘 잔다' },
  { id: 'daytimeCause', text: '낮에 피곤하거나 기분이 나쁜 것은 모두 잠 때문이다' },
];

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

export const pregnancyInfo = {
  title: '임산부에게 일반적인 CBT-I를 적용할 수 없는 이유',
  stages: [
    {
      name: '임신 초기(1~3개월)',
      points: [
        '호르몬의 변화: 임신으로 프로게스테론(자궁 내막을 수정란이 착상하기 좋게 준비시키고, 임신 기간 동안 자궁 근육의 수축을 억제하여 배아의 착상을 유지하는 임신의 필수 호르몬) 수치가 증가해 수면 주기가 교란됩니다.',
        '기타 초기 증상: 입덧, 가슴 통증, 잦은 배뇨(빈뇨), 소화 불량 등의 증상이 수면을 방해합니다.',
      ],
    },
    {
      name: '임신 중기(4~7개월)',
      points: ['체형의 변화: 자궁이 커지면서 방광을 압박해 빈뇨 증상이 심해지고, 횡격막을 압박해 폐활량이 감소하며 수면 무호흡증 발생 가능성이 증가합니다. 이외에도 체중이 증가하고 배가 나오며 허리 통증, 골반 통증, 다리 경련 등이 동반되어 수면을 방해합니다.'],
    },
    {
      name: '임신 후기(8~10개월)',
      points: [
        '신체적 부담 극대화: 배가 무거워져 편안한 수면 자세를 찾기 어렵고, 하지불안증후군(다리가 저리거나 벌레가 기어가는 듯한 불쾌한 느낌) 발생 위험이 증가합니다.',
        '역류 및 소화 장애: 자궁이 위를 눌러 속쓰림이나 신물이 올라오는 증상이 악화됩니다.',
        '심리적 불안: 출산과 육아에 대한 걱정, 높은 체온과 땀 분비로 인한 교감신경 활성이 잠을 방해합니다.',
      ],
    },
  ],
  conclusion: '사람별로 증상과 발현 시기가 다를 수 있으나, 일반인에 비해 신체적인 요인이 수면 방해에 큰 비중을 차지합니다. 그래서 일반적인 CBT-I만으로는 수면 교정이 어려울 수 있습니다.',
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
  arousal: { scale: arousalScale, domains: arousalDomains, corticalNote: corticalArousalNote },
  beliefs: beliefItems,
  trackInfo,
  pregnancyInfo,
});
