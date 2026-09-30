const screens = { home: document.getElementById("home-screen"), recipe: document.getElementById("recipe-screen"), cooking: document.getElementById("cooking-screen") };
let cookingSteps = [
  { title: "재료를 준비해요", text: "마늘은 편으로 썰고, 방울토마토는 반으로 잘라주세요.", tip: "TIP · 마늘의 꼭지는 미리 제거하면 편해요." },
  { title: "마늘 향을 내요", text: "중약불의 팬에 올리브오일과 마늘을 넣고 노릇해질 때까지 볶아요.", tip: "TIP · 마늘이 타지 않도록 불을 너무 세게 하지 마세요." },
  { title: "면을 함께 끓여요", text: "토마토소스, 물 400ml, 면을 넣고 10분간 끓여주세요. 중간중간 저어줘요.", tip: "TIP · 물이 부족해 보이면 뜨거운 물을 조금씩 추가해요." },
  { title: "맛있게 마무리해요", text: "면이 익으면 소금과 후추로 간하고, 원한다면 치즈를 올려 완성해요.", tip: "TIP · 불을 끈 뒤 올리브오일을 살짝 두르면 풍미가 좋아져요." }
];
let currentStep = 0;
const showScreen = (name) => Object.entries(screens).forEach(([key, screen]) => { screen.hidden = key !== name; });

const recipeButton = document.getElementById("recipe-button");
const requestMessage = document.getElementById("request-message");

recipeButton.addEventListener("click", async () => {
  const url = document.getElementById("youtube-url").value.trim();
  if (!url) return showRequestMessage("YouTube 링크를 먼저 입력해주세요.", true);
  recipeButton.disabled = true;
  recipeButton.textContent = "레시피 정리 중…";
  showRequestMessage("영상과 자막을 읽고 있어요. 잠시만 기다려주세요.");
  try {
    const response = await fetch("/api/recipes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setRecipe(data);
    showScreen("recipe");
  } catch (error) {
    showRequestMessage(error.message || "레시피를 만들지 못했습니다. 다시 시도해주세요.", true);
  } finally {
    recipeButton.disabled = false;
    recipeButton.innerHTML = "레시피 만들기 <span>→</span>";
  }
});

function showRequestMessage(message, isError = false) {
  requestMessage.textContent = message;
  requestMessage.classList.toggle("is-error", isError);
}

function setRecipe(data) {
  const { video, recipe } = data;
  document.getElementById("recipe-thumbnail").src = video.thumbnail;
  document.getElementById("recipe-thumbnail").alt = `${recipe.title} 영상 썸네일`;
  document.getElementById("recipe-title").textContent = recipe.title;
  document.getElementById("recipe-servings").textContent = recipe.servings;
  document.getElementById("recipe-time").textContent = `⏱ ${recipe.cookingTime}`;
  document.getElementById("cooking-recipe-title").textContent = recipe.title;
  document.getElementById("ingredients").innerHTML = recipe.ingredients.map(({ name, amount }) => `<li><span>${escapeHtml(name)}</span><strong>${escapeHtml(amount)}</strong></li>`).join("");
  document.getElementById("steps-preview").innerHTML = recipe.steps.map(({ description }) => `<li>${escapeHtml(description)}</li>`).join("");
  cookingSteps = recipe.steps.map(({ title, description, tip }) => ({ title, text: description, tip: tip || "TIP · 영상의 조리 순서를 확인하며 진행하세요." }));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}
document.querySelector("[data-go-home]").addEventListener("click", () => showScreen("home"));
document.querySelector("[data-go-recipe]").addEventListener("click", () => showScreen("recipe"));
document.getElementById("start-cooking").addEventListener("click", () => { currentStep = 0; renderStep(); showScreen("cooking"); });

function renderStep() {
  const step = cookingSteps[currentStep];
  document.getElementById("step-label").textContent = `STEP ${String(currentStep + 1).padStart(2, "0")}`;
  document.getElementById("step-count").textContent = `${String(currentStep + 1).padStart(2, "0")} / ${String(cookingSteps.length).padStart(2, "0")}`;
  document.getElementById("step-title").textContent = step.title;
  document.getElementById("step-text").textContent = step.text;
  document.getElementById("step-tip").textContent = step.tip;
  document.getElementById("progress-bar").style.width = `${((currentStep + 1) / cookingSteps.length) * 100}%`;
  document.getElementById("prev-step").disabled = currentStep === 0;
  document.getElementById("next-step").textContent = currentStep === cookingSteps.length - 1 ? "레시피 보기" : "다음 단계 →";
}
document.getElementById("prev-step").addEventListener("click", () => { if (currentStep > 0) { currentStep--; renderStep(); } });
document.getElementById("next-step").addEventListener("click", () => { if (currentStep < cookingSteps.length - 1) { currentStep++; renderStep(); } else { showScreen("recipe"); } });
document.addEventListener("keydown", (event) => { if (!screens.cooking.hidden && event.key === "ArrowLeft") document.getElementById("prev-step").click(); if (!screens.cooking.hidden && event.key === "ArrowRight") document.getElementById("next-step").click(); });
