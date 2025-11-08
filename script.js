/* ===== WeatherNow — Final JS ===== */
const apiKey = "92891e3c166d7a28ce8177db12057646"; // replace with your own if needed

// DOM
const btn = document.getElementById("searchBtn");
const locBtn = document.getElementById("locBtn");
const cityInput = document.getElementById("city");
const dataBox = document.getElementById("weather-data");
const shimmer = document.getElementById("shimmer");
const errorMsg = document.getElementById("error");
const forecastSection = document.getElementById("forecast-section");
const forecastContainer = document.getElementById("forecast-container");
const forecastShimmer = document.getElementById("forecast-shimmer");
const loading = document.getElementById("loading");
const themeBtn = document.getElementById("themeToggle");

let clockInterval = null;
let liveBackgroundInterval = null;

// --- Event Listeners ---
btn.addEventListener("click", () => {
  const city = cityInput.value.trim();
  if (city) getWeather(city);
});

locBtn.addEventListener("click", () => {
  loading.classList.remove("hidden");
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        fetchWeatherByCoords(coords.latitude, coords.longitude);
        loading.classList.add("hidden");
      },
      () => {
        loading.textContent = "Location access denied.";
        setTimeout(() => loading.classList.add("hidden"), 3000);
      }
    );
  } else {
    loading.textContent = "Geolocation not supported.";
    setTimeout(() => loading.classList.add("hidden"), 3000);
  }
});

// Show your local device time until weather loads
window.addEventListener("load", () => {
  startClock(new Date().getTimezoneOffset() * -60); // local offset (minutes) -> seconds
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => fetchWeatherByCoords(coords.latitude, coords.longitude),
      () => {}
    );
  }
});

// --- Theme (auto + manual + saved) ---
window.addEventListener("DOMContentLoaded", () => {
  const userPref = localStorage.getItem("theme");
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const hourLocal = new Date().getHours();

  if (hourLocal >= 18 || hourLocal < 6 || userPref === "dark" || (!userPref && systemDark)) {
    document.body.classList.remove("light-mode");
    themeBtn.innerHTML = '<i class="fas fa-moon"></i>';
  } else {
    document.body.classList.add("light-mode");
    themeBtn.innerHTML = '<i class="fas fa-sun"></i>';
  }
});

themeBtn.addEventListener("click", () => {
  document.body.classList.toggle("light-mode");
  if (document.body.classList.contains("light-mode")) {
    themeBtn.innerHTML = '<i class="fas fa-sun"></i>';
    localStorage.setItem("theme", "light");
  } else {
    themeBtn.innerHTML = '<i class="fas fa-moon"></i>';
    localStorage.setItem("theme", "dark");
  }
  // Re-apply background with current condition
  const lastWeather = document.getElementById("desc").textContent.toLowerCase();
  const icon = document.getElementById("icon").src.includes("n") ? "n" : "d";
  setBackground(lastWeather, icon);
});

// --- Fetch Current Weather ---
async function getWeather(city) {
  try {
    showShimmer();
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`
    );
    if (!res.ok) throw new Error("City not found");
    const data = await res.json();
    displayWeather(data);
    fetchForecast(data.coord.lat, data.coord.lon, data.timezone);
  } catch (err) {
    hideShimmer();
    errorMsg.textContent = err.message;
    dataBox.classList.add("hidden");
    forecastSection.classList.add("hidden");
  }
}

async function fetchWeatherByCoords(lat, lon) {
  try {
    showShimmer();
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
    );
    if (!res.ok) throw new Error("Location error");
    const data = await res.json();
    displayWeather(data);
    fetchForecast(data.coord.lat, data.coord.lon, data.timezone);
  } catch {
    hideShimmer();
    errorMsg.textContent = "Unable to get your location.";
  }
}

// --- Display Current Weather ---
function displayWeather(data) {
  hideShimmer();
  errorMsg.textContent = "";
  dataBox.classList.remove("hidden");

  const weatherMain = data.weather[0].main.toLowerCase();
  const weatherDesc = data.weather[0].description.toLowerCase();
  const icon = data.weather[0].icon;
  const offset = data.timezone; // seconds from UTC

  document.getElementById("location").textContent = `${data.name}, ${data.sys.country}`;
  document.getElementById("temp").textContent = `${data.main.temp.toFixed(1)}°C`;
  document.getElementById("desc").textContent = weatherDesc;
  document.getElementById("humid").textContent = `💧 ${data.main.humidity}%`;
  document.getElementById("wind").textContent = `🌬️ ${data.wind.speed} m/s`;
  document.getElementById("icon").src = `https://openweathermap.org/img/wn/${icon}@2x.png`;

  // Update live clock & background (with correct timezone math)
  startClock(offset);
  setBackground(weatherMain, icon);
  enableLiveBackground(weatherMain, icon, offset);

  // Start auto refresh after first load
  storeLastWeatherData(data.name, data.coord.lat, data.coord.lon, offset);
  startAutoRefresh();
}

// --- Fixed & Enhanced Clock (uses UTC + offset) ---
function startClock(offsetSeconds) {
  if (clockInterval) clearInterval(clockInterval);

  const dateEl = document.getElementById("date");
  const timeEl = document.getElementById("time");

  const tick = () => {
    // "nowLocal" is a synthetic time: UTC now + city's offset, formatted in UTC
    const nowLocal = new Date(Date.now() + offsetSeconds * 1000);

    // Format using UTC timezone to avoid system TZ interference
    dateEl.textContent = nowLocal.toLocaleDateString("en-IN", {
      weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC"
    });

    const timeStr = nowLocal.toLocaleTimeString("en-IN", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "UTC"
    });

    const hour = nowLocal.getUTCHours(); // hour in the city's local time
    const isDay = hour >= 6 && hour < 18;

    timeEl.innerHTML = `${timeStr}
      <span id="dayNightIcon" class="${isDay ? "day" : "night"}">
        ${isDay ? "☀️" : "🌙"}
      </span>`;
  };

  tick();
  clockInterval = setInterval(tick, 1000);
}

// --- Shimmer control ---
function showShimmer() { shimmer.classList.remove("hidden"); dataBox.classList.add("hidden"); }
function hideShimmer() { shimmer.classList.add("hidden"); dataBox.classList.remove("hidden"); }

// --- Backgrounds & Animations (Weather + Day/Night variants) ---
function setBackground(weather, iconCode) {
  const base = "assets/";
  const anim = document.getElementById("weather-animation");
  anim.innerHTML = ""; // reset particles

  const isNightIcon = (typeof iconCode === "string") && iconCode.includes("n");
  const theme = document.body.classList.contains("light-mode") ? "day" : "night";
  let img = `sunny-day.png`;

  if (weather.includes("thunderstorm")) {
    img = `storm-${theme}.png`; makeRain(100); makeLightning();
  } else if (weather.includes("rain") || weather.includes("drizzle")) {
    img = `rain-${theme}.png`; makeRain(100);
  } else if (weather.includes("snow")) {
    img = `snow-${theme}.png`; makeSnow(60);
  } else if (weather.includes("cloud")) {
    img = `cloudy-${theme}.png`; makeClouds(8);
  } else if (weather.includes("mist") || weather.includes("fog") || weather.includes("haze")) {
    img = `fog-${theme}.png`; makeClouds(5);
  } else if (weather.includes("clear")) {
    img = `sunny-${isNightIcon ? "night" : "day"}.png`;
    if (isNightIcon) makeStars(30); else makeSun();
  }

  document.body.style.background = `url(${base}${img}) no-repeat center/cover`;
}

// --- Live Background Refresh (keeps day/night in sync while open) ---
function enableLiveBackground(weather, iconCode, offsetSeconds) {
  if (liveBackgroundInterval) clearInterval(liveBackgroundInterval);

  const updateBackground = () => {
    const nowLocal = new Date(Date.now() + offsetSeconds * 1000);
    const hour = nowLocal.getUTCHours();
    const isDay = hour >= 6 && hour < 18;
    const updatedIcon = (typeof iconCode === "string")
      ? (isDay ? iconCode.replace("n", "d") : iconCode.replace("d", "n"))
      : iconCode;
    setBackground(weather, updatedIcon);
  };

  updateBackground();
  liveBackgroundInterval = setInterval(updateBackground, 60000); // 1 min
}

// --- Particle Generators ---
function makeClouds(n){
  const a = document.getElementById("weather-animation");
  for(let i=0;i<n;i++){
    const c = document.createElement("div");
    const s = Math.random()*80+40;
    c.className="cloud";
    c.style.width=`${s}px`; c.style.height=`${s*0.6}px`;
    c.style.top=`${Math.random()*60}vh`;
    c.style.left=`${Math.random()*100-100}px`;
    c.style.animationDuration=`${60+Math.random()*20}s`;
    a.appendChild(c);
  }
}
function makeRain(n){
  const a = document.getElementById("weather-animation");
  for(let i=0;i<n;i++){
    const d=document.createElement("div");
    d.className="raindrop";
    d.style.left=`${Math.random()*100}vw`;
    d.style.animationDuration=`${0.5+Math.random()}s`;
    a.appendChild(d);
  }
}
function makeSnow(n){
  const a = document.getElementById("weather-animation");
  for(let i=0;i<n;i++){
    const s=document.createElement("div");
    s.className="snowflake"; s.textContent="❄";
    s.style.left=`${Math.random()*100}vw`;
    s.style.fontSize=`${Math.random()*10+10}px`;
    s.style.animationDuration=`${5+Math.random()*10}s`;
    a.appendChild(s);
  }
}
function makeSun(){
  const a=document.getElementById("weather-animation");
  const r=document.createElement("div"); r.className="sunray"; a.appendChild(r);
}
function makeStars(n){
  const a=document.getElementById("weather-animation");
  for(let i=0;i<n;i++){
    const s=document.createElement("div");
    s.className="star";
    s.style.left=`${Math.random()*100}vw`;
    s.style.top=`${Math.random()*80}vh`;
    s.style.animationDuration=`${2+Math.random()*3}s`;
    a.appendChild(s);
  }
}
function makeLightning(){
  const a=document.getElementById("weather-animation");
  const flash=document.createElement("div");
  flash.className="lightning"; a.appendChild(flash);
  setInterval(()=>{ flash.classList.toggle("active"); }, 4000);
}

// --- Forecast (with shimmer) ---
async function fetchForecast(lat, lon, tzOffset) {
  try {
    showForecastShimmer();
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
    );
    if (!res.ok) throw new Error("Forecast error");
    const data = await res.json();
    renderForecast(data.list, tzOffset);
  } catch {
    hideForecastShimmer();
    forecastSection.classList.add("hidden");
  }
}

function renderForecast(list, tzOffset) {
  forecastContainer.innerHTML = "";
  forecastSection.classList.remove("hidden");
  hideForecastShimmer();

  // 3-hour steps; pick one entry per day (~every 8th)
  const daily = list.filter((_, i) => i % 8 === 0).slice(0, 5);

  daily.forEach(entry => {
    // Use UTC+offset and FORMAT in UTC to avoid system TZ
    const dt = new Date(entry.dt * 1000 + tzOffset * 1000);

    const day  = dt.toLocaleDateString("en-IN", { weekday:"short", timeZone:"UTC" });
    const time = dt.toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit", timeZone:"UTC" });

    const card = document.createElement("div");
    card.className = "forecast-card";
    card.innerHTML = `
      <div class="forecast-day">${day}</div>
      <div class="forecast-time">${time}</div>
      <img src="https://openweathermap.org/img/wn/${entry.weather[0].icon}@2x.png" alt="icon"/>
      <div class="forecast-temp">${entry.main.temp_min.toFixed(0)}° / ${entry.main.temp_max.toFixed(0)}°C</div>
      <div class="forecast-desc">${entry.weather[0].description}</div>
    `;
    forecastContainer.appendChild(card);
  });
}

function showForecastShimmer(){ forecastShimmer.classList.remove("hidden"); forecastContainer.classList.add("hidden"); }
function hideForecastShimmer(){ forecastShimmer.classList.add("hidden");   forecastContainer.classList.remove("hidden"); }

// --- Auto Weather Refresh Every 30 Minutes ---
let autoRefreshInterval = null;
let lastCity = null, lastLat = null, lastLon = null, lastOffset = null;

function storeLastWeatherData(city, lat, lon, offset) {
  lastCity = city; lastLat = lat; lastLon = lon; lastOffset = offset;
}

function startAutoRefresh() {
  if (autoRefreshInterval) clearInterval(autoRefreshInterval);
  autoRefreshInterval = setInterval(async () => {
    if (lastLat && lastLon) {
      try {
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${lastLat}&lon=${lastLon}&appid=${apiKey}&units=metric`
        );
        const data = await res.json();
        displayWeather(data);
        fetchForecast(lastLat, lastLon, lastOffset);
      } catch {
        // silent retry next cycle
      }
    }
  }, 30 * 60 * 1000);
}
