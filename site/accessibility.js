const skipLabels = {
  en: "Skip to lesson content", es: "Ir al contenido de la lección",
  pt: "Ir para o conteúdo da lição", fr: "Aller au contenu de la leçon",
  it: "Vai al contenuto della lezione", de: "Zum Lektionsinhalt springen",
  nl: "Naar de lesinhoud", pl: "Przejdź do treści lekcji",
  tr: "Ders içeriğine geç", id: "Lewati ke isi pelajaran",
  vi: "Chuyển đến nội dung bài học", el: "Μετάβαση στο περιεχόμενο μαθήματος",
  uk: "Перейти до вмісту уроку", ru: "Перейти к содержанию урока",
  zh: "跳转到课程内容", "zh-TW": "跳至課程內容",
  ja: "レッスン内容へ移動", ko: "수업 내용으로 건너뛰기",
  hi: "पाठ की सामग्री पर जाएँ", ar: "انتقل إلى محتوى الدرس",
  he: "דלג לתוכן השיעור",
};

export function installAccessibility() {
  const target = document.querySelector(".info-card");
  target.id = "lesson-content";
  target.tabIndex = -1;
  const skip = document.createElement("a");
  skip.className = "skip-link";
  skip.href = "#lesson-content";
  const relabel = () => {
    skip.textContent = skipLabels[document.documentElement.lang] ?? skipLabels.en;
  };
  relabel();
  new MutationObserver(relabel).observe(document.documentElement,
    { attributes: true, attributeFilter: ["lang"] });
  skip.addEventListener("click", event => {
    event.preventDefault();
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "nearest" });
  });
  document.body.prepend(skip);
}
