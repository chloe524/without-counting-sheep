// DBAS-16(Dysfunctional Beliefs and Attitudes about Sleep-16, Morin et al. 2007). 수면에 대한 역기능적 생각·태도를 평가한다.
// 0(전혀 동의하지 않음)~10(매우 동의함). 문항 평균이 높을수록 역기능적 믿음이 강하다.
// 3·4·5·7번은 연구자가 준 문구이고 나머지는 연구용 임시 번역이다. 공식 한국어판과 하위척도 배정은 원문과 대조가 필요하다.
export const dbasSurvey = {
  name: '수면에 대한 역기능적 신념과 태도 척도(DBAS-16)',
  source: '출처: Morin CM, Vallières A, Ivers H (2007), Sleep 30(11):1547-1554.',
  scaleNote: '0 = 전혀 동의하지 않음, 10 = 매우 동의함',
  items: [
    { id: 1, text: '낮에 개운하고 제 기능을 하려면 8시간은 자야 한다.', subscale: 'expectations' },
    { id: 2, text: '잠을 충분히 못 잔 날은 다음 날 낮잠이나 다음 날 밤에 더 자서 보충해야 한다.', subscale: 'expectations' },
    { id: 3, text: '나는 만성 불면증이 내 몸에 심각한 결과를 미칠까 염려된다.', subscale: 'worry' },
    { id: 4, text: '나는 내가 잠에 대한 통제력을 잃을까 염려된다.', subscale: 'worry' },
    { id: 5, text: '나는 내가 밤의 나쁜 수면의 질로 인해 다음날 내 활동을 방해받을 것임을 염려한다.', subscale: 'consequences' },
    { id: 6, text: '낮에 정신을 차리고 제 기능을 하려면, 잠을 설치느니 수면제를 먹는 편이 낫다.', subscale: 'medication' },
    { id: 7, text: '내가 짜증이 나거나, 우울하거나, 화가 나는 날은 내가 밤에 잠을 잘 자지 못했기 때문이다.', subscale: 'consequences' },
    { id: 8, text: '하룻밤 잠을 설치면 한 주의 수면 일정이 모두 흐트러진다.', subscale: 'worry' },
    { id: 9, text: '밤에 충분히 자지 못하면 다음 날 거의 아무것도 할 수 없다.', subscale: 'consequences' },
    { id: 10, text: '오늘 밤 잘 잘지 못 잘지 전혀 예측할 수 없다.', subscale: 'worry' },
    { id: 11, text: '잠을 설쳐서 생기는 나쁜 영향을 다룰 능력이 나에게는 거의 없다.', subscale: 'worry' },
    { id: 12, text: '낮에 피곤하거나 기운이 없고 일이 잘 안 되는 것은 대개 전날 밤 잠을 못 잤기 때문이다.', subscale: 'consequences' },
    { id: 13, text: '불면은 근본적으로 몸속 화학적 불균형 때문이라고 생각한다.', subscale: 'medication' },
    { id: 14, text: '불면 때문에 삶을 즐기지 못하고 하고 싶은 일을 못 한다.', subscale: 'worry' },
    { id: 15, text: '불면을 해결하는 방법은 아마 약뿐일 것이다.', subscale: 'medication' },
    { id: 16, text: '잠을 설친 다음 날에는 약속이나 할 일을 피하거나 취소한다.', subscale: 'worry' },
  ],
  subscales: {
    consequences: '수면 부족의 결과',
    worry: '수면에 대한 걱정과 무력감',
    expectations: '수면에 대한 기대',
    medication: '수면제에 대한 생각',
  },
  // 평균 4점 이상을 역기능적 믿음이 두드러진 수준으로 본다. [원문 대조 필요]
  highMean: 4,
};
