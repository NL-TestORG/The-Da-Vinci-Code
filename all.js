// require('dotenv').config(); // 讀取 .env
// const azureKey = process.env.AZURE_SPEECH_KEY;
// const azureRegion = process.env.AZURE_SPEECH_REGION;



// encryptedKey 是你剛剛用 CryptoJS 產生的加密金鑰字串
const encryptedKey = "U2FsdGVkX1/r4PTRr/HVQKeKnKd0IjKc3NWjzgqI/pw2bKmZBk3AwFKemWoUyGkJHQjvqkSCNKDki8e2MVVE+IE44BleaNVt3sexWfGIukBQjW7V46+k6AUTQlj2ogaHzgmaHKya/JJfR4mXGTSPDw==";

// 密碼（要跟加密時一致）
const password = "mySecret123";

// 解密函式
function decryptKey() {
  const decrypted = CryptoJS.AES.decrypt(encryptedKey, password);
  const key = decrypted.toString(CryptoJS.enc.Utf8);
  return key;
}


const azureKey = decryptKey();
const azureRegion = "eastasia";

console.log("Using speech key:", azureKey);
console.log("Using speech region:", azureRegion);

let secretNumber;
let min = 1;
let max = 30;
let attemptsLeft = 3;
let guesses = [];
let timer = 10;
let timerMax = 10;
let timerInterval = null;

const resultEl = document.getElementById("result");
const giftEl = document.getElementById("gift");
const failEl = document.getElementById("fail");
const speakBtn = document.getElementById("speakBtn");
const guessesEl = document.getElementById("guesses");
const timerBar = document.getElementById("timerBar");
const timerText = document.getElementById("timerText");

/**
 * 開始新遊戲，重設所有狀態與畫面
 */
function startGame() {
  secretNumber = Math.floor(Math.random() * 30) + 1;
  min = 1;
  max = 30;
  attemptsLeft = 3;
  guesses = [];
  resultEl.textContent = "";
  giftEl.style.display = "none";
  failEl.style.display = "none";
  speakBtn.disabled = false;
  document.getElementById("instruction").textContent = `請說出你猜的數字（範圍 ${min}～${max}）`;
  stopTimer();
  resetTimer();
  updateTimerBar();
  updateGuessesDisplay();
  document.querySelector('button[onclick="startGame()"]').disabled = true;
  document.getElementById('resetBtn').style.display = "none";
  // 不要清空 speechTexts，保留語音內容顯示
  // 自動啟動語音偵測
  startSpeech();
}

/**
 * 更新猜測紀錄的顯示內容
 */
function updateGuessesDisplay() {
  if (guesses.length === 0) {
    guessesEl.textContent = "";
    return;
  }
  guessesEl.innerHTML = guesses.map((num, idx) => `第${idx+1}次猜測：${num}`).join("<br>");
}

/**
 * 啟動倒數計時器，並每 0.1 秒更新進度條
 */
function startTimer() {
  stopTimer();
  timer = timerMax;
  updateTimerBar();
  timerInterval = setInterval(() => {
    timer -= 0.1;
    updateTimerBar();
    if (timer <= 0) {
      timer = 0;
      updateTimerBar();
      stopTimer();
      onTimeout();
    }
  }, 100);
}

/**
 * 停止倒數計時器
 */
function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

/**
 * 重設倒數計時器至最大值
 */
function resetTimer() {
  timer = timerMax;
  updateTimerBar();
}

/**
 * 根據目前倒數時間更新進度條與顯示文字
 */
function updateTimerBar() {
  const percent = Math.max(0, Math.min(1, timer / timerMax));
  timerBar.style.width = (percent * 100) + "%";
  timerText.textContent = `${Math.ceil(timer)} 秒`;
  if (percent > 0.5) {
    timerBar.style.background = "linear-gradient(90deg,#6a11cb,#2575fc)";
  } else if (percent > 0.2) {
    timerBar.style.background = "linear-gradient(90deg,#f7971e,#ffd200)";
  } else {
    timerBar.style.background = "linear-gradient(90deg,#f953c6,#b91d73)";
  }
}

/**
 * 倒數歸零時的處理：扣除一次機會並顯示提示
 */
function onTimeout() {
  // 倒數歸零時自動扣除一次機會
  if (speakBtn.disabled) return;
  attemptsLeft--;
  guesses.push("（超時）");
  updateGuessesDisplay();
  resultEl.textContent = "⌛ 超過 10 秒未作答，扣除一次機會";
  if (attemptsLeft === 0) {
    failEl.style.display = "block";
    speakBtn.disabled = true;
    resultEl.textContent = `😢 遊戲結束，正確答案是 ${secretNumber}`;
    document.getElementById('resetBtn').style.display = "inline-block";
    setTimeout(() => {
      resetToInitial();
    }, 10000); // 10秒後自動回到初始畫面
  } else {
    document.getElementById("instruction").textContent = `請說出你猜的數字（範圍 ${min}～${max}）`;
    speakBtn.disabled = false;
  }
}

/**
 * 按下「說出你的猜測」時，啟動語音辨識與倒數計時
 */
function startSpeech(retry = false) {
  speakBtn.disabled = true;
  resetTimer();
  startTimer();
  const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(azureKey, azureRegion);
  speechConfig.speechRecognitionLanguage = "zh-TW";
  const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
  const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

  resultEl.textContent = retry ? "請再說一次..." : "正在辨識語音...";

  recognizer.recognizeOnceAsync(result => {
    stopTimer();
    speakBtn.disabled = false;
    recognizer.close();

    if (result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
      updateSpeechTextDisplay(result.text);

      // 新增：先去除標點符號與空白，並將「是」直接取代為「四」
      let cleanText = result.text.replace(/[^\d一二三四五六七八九十零兩是五]/g, '');
      if (cleanText === "是") cleanText = "四";
      // 強化：「五」如果被誤辨為空字串，或語音內容有「5」或"five"或"伍"，都視為「五」
      if (
        (!cleanText && (/五/.test(result.text) || /5/.test(result.text) || /伍/.test(result.text) || /five/i.test(result.text)))
        || cleanText === ""
      ) {
        cleanText = "五";
      }

      // 統一判斷式：先找「[一二三四五六七八九]十[一二三四五六七八九]?」或「十[一二三四五六七八九]?」，再找阿拉伯數字，再找單一國字數字
      let guess;
      let singleMatch = cleanText.match(/^([一二三四五六七八九五])$/);
      if (singleMatch) {
        guess = chineseNumToDigit(singleMatch[0]);
      } else {
        // 判斷十幾（10~19）
        let teenMatch = cleanText.match(/^十([一二三四五六七八九])?$/);
        if (teenMatch) {
          guess = chineseNumToDigit(teenMatch[0]);
        } else {
          // 判斷二十幾（20~29）
          let twentyMatch = cleanText.match(/^二十([一二三四五六七八九])?$/);
          if (twentyMatch) {
            guess = chineseNumToDigit(twentyMatch[0]);
          } else {
            // 判斷阿拉伯數字
            let numMatch = cleanText.match(/\d{1,3}/);
            if (numMatch) {
              guess = parseInt(numMatch[0], 10);
            } else {
              guess = NaN;
            }
          }
        }
      }

      if (isNaN(guess) || guess < min || guess > max) {
        resultEl.textContent = `⚠️ 請說出 ${min} 到 ${max} 的整數`;
      } else {
        guesses.push(guess);
        updateGuessesDisplay();
        checkAnswer(guess);
      }
    } else if (result.reason === SpeechSDK.ResultReason.NoMatch) {
      if (!retry) {
        // 第一次沒辨識到，自動再啟動一次
        startSpeech(true);
      } else {
        resultEl.textContent = "❌ 沒有辨識到語音，請清楚說出一個數字";
      }
    } else if (result.reason === SpeechSDK.ResultReason.Canceled) {
      const cancellation = SpeechSDK.CancellationDetails.fromResult(result);
      if (cancellation.reason === SpeechSDK.CancellationReason.Error) {
        resultEl.textContent = `❌ 辨識失敗，錯誤訊息：${cancellation.errorDetails}`;
      } else {
        resultEl.textContent = "❌ 語音辨識已取消，請再試一次";
      }
    } else {
      resultEl.textContent = "❌ 語音辨識失敗，請再按一次「說出你的猜測」";
    }
  });
}

/**
 * 將常見中文數字（十位數以下）轉換為阿拉伯數字
 */
function chineseNumToDigit(text) {
  const map = {
    "零": 0, "一": 1, "二": 2, "兩": 2, "三": 3, "四": 4, "是": 4, "五": 5,
    "六": 6, "七": 7, "八": 8, "九": 9, "十": 10
  };
  // 處理「十」開頭（如「十三」=13、「十二」=12、「十」=10）
  if (/^十[一二三四五六七八九]?$/.test(text)) {
    if (text.length === 1) return 10;
    return 10 + map[text[1]];
  }
  // 處理「一十X」格式（如「一十三」=13）
  if (/^[一二三四五六七八九]十[一二三四五六七八九]?$/.test(text)) {
    const ten = map[text[0]] * 10;
    if (text.length === 2) return ten;
    return ten + map[text[2]];
  }
  // 處理單一數字或「是」
  if (map.hasOwnProperty(text)) return map[text];
  // 若是單一字元且為「是」，也回傳4
  if (text.length === 1 && text === "是") return 4;
  return NaN;
}

/**
 * 顯示每次語音辨識的原始內容
 */
function updateSpeechTextDisplay(text) {
  let speechTextEl = document.getElementById('speechText');
  if (!speechTextEl) {
    speechTextEl = document.createElement('div');
    speechTextEl.id = 'speechText';
    speechTextEl.style.margin = '18px auto 0 auto';
    speechTextEl.style.maxWidth = '340px';
    speechTextEl.style.fontSize = '1em';
    speechTextEl.style.color = '#333';
    speechTextEl.style.background = '#fff6';
    speechTextEl.style.borderRadius = '12px';
    speechTextEl.style.padding = '8px 0 8px 0';
    speechTextEl.style.fontFamily = "'Noto Sans TC', Arial, sans-serif";
    document.body.insertBefore(speechTextEl, document.getElementById('guesses').nextSibling);
  }
  if (!window.speechTexts) window.speechTexts = [];
  window.speechTexts.push(text);
  if (window.speechTexts.length > 3) window.speechTexts.shift();
  speechTextEl.innerHTML = window.speechTexts.map((t, i) => `第${i+1}次語音內容：${t}`).join("<br>");
}

/**
 * 檢查猜測結果，更新遊戲狀態與畫面
 */
function checkAnswer(guess) {
  attemptsLeft--;
  if (guess === secretNumber) {
    resultEl.textContent = `✅ 恭喜你猜中了！答案就是 ${secretNumber}`;
    giftEl.classList.add('show-gift');
    giftEl.style.display = "flex";
    speakBtn.disabled = true;
    document.querySelector('button[onclick="startGame()"]').disabled = false;
    setTimeout(() => {
      giftEl.style.display = "none";
      giftEl.classList.remove('show-gift');
      startGame();
    }, 3000);
  } else {
    if (guess < secretNumber) {
      min = Math.max(min, guess + 1);
      resultEl.textContent = `猜錯了！答案比 ${guess} 大，剩下 ${attemptsLeft} 次機會`;
    } else {
      max = Math.min(max, guess - 1);
      resultEl.textContent = `猜錯了！答案比 ${guess} 小，剩下 ${attemptsLeft} 次機會`;
    }
    document.getElementById("instruction").textContent = `請說出你猜的數字（範圍 ${min}～${max}）`;
    if (attemptsLeft === 0) {
      resultEl.textContent = `😢 遊戲結束，正確答案是 ${secretNumber}`;
      failEl.style.display = "block";
      document.getElementById('resetBtn').style.display = "inline-block";
      speakBtn.disabled = true;
      document.querySelector('button[onclick="startGame()"]').disabled = false;
      setTimeout(() => {
        resetToInitial();
      }, 10000); // 1秒後自動回到初始畫面
    }
  }
  document.querySelector('button[onclick="startGame()"]').disabled = false;
}

/**
 * 回到初始畫面功能
 */
function resetToInitial() {
  secretNumber = undefined;
  min = 1;
  max = 30;
  attemptsLeft = 3;
  guesses = [];
  resultEl.textContent = "";
  giftEl.style.display = "none";
  failEl.style.display = "none";
  speakBtn.disabled = true;
  document.getElementById("instruction").textContent = "請說出你猜的數字（範圍 1～30）";
  stopTimer();
  resetTimer();
  updateTimerBar();
  updateGuessesDisplay();
  document.querySelector('button[onclick="startGame()"]').disabled = false;
  // 只有在回到初始畫面時才清空語音內容
  window.speechTexts = [];
  let speechTextEl = document.getElementById('speechText');
  if (speechTextEl) speechTextEl.innerHTML = '';
}

/**
 * 完全重置遊戲，回到初始畫面
 */
function restartGame() {
  // 完全重置所有狀態與畫面
  secretNumber = undefined;
  min = 1;
  max = 30;
  attemptsLeft = 3;
  guesses = [];
  resultEl.textContent = "";
  giftEl.style.display = "none";
  failEl.style.display = "none";
  speakBtn.disabled = true;
  document.getElementById("instruction").textContent = "請說出你猜的數字（範圍 1～30）";
  stopTimer();
  resetTimer();
  updateTimerBar();
  updateGuessesDisplay();
  document.querySelector('button[onclick="startGame()"]').disabled = false;
  document.getElementById('resetBtn').style.display = "none";
  // 清空語音內容
  window.speechTexts = [];
  let speechTextEl = document.getElementById('speechText');
  if (speechTextEl) speechTextEl.innerHTML = '';
}

// 綁定resetBtn事件
document.addEventListener('DOMContentLoaded', function() {
  const resetBtn = document.getElementById('resetBtn');
  if (resetBtn) {
    resetBtn.onclick = resetToInitial;
  }

// ==========================================
// 🚨 測試用：刻意製造的 DOM XSS 漏洞 🚨
// ==========================================
function showWelcomeMessage() {
  // 1. 從網址列取得使用者輸入的參數 (Source)
  const params = new URLSearchParams(window.location.search);
  const userName = params.get('name');
  
  if (userName) {
    // 2. 未經任何消毒 (Sanitization)，直接使用 innerHTML 寫入畫面 (Sink)
    // 💡 駭客可以傳遞 ?name=<img src=x onerror=alert('駭客入侵')> 來執行惡意程式碼
    const instructionEl = document.getElementById("instruction");
    instructionEl.innerHTML = "歡迎玩家：" + userName + "！<br>請說出你猜的數字（範圍 1～30）";
  }
}

// 確保在網頁載入時執行這個危險函式
document.addEventListener('DOMContentLoaded', showWelcomeMessage);
// ==========================================
  
});
