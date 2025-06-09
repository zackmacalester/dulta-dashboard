
// this would be the full original App.jsx content but adjusted surgically
// since code execution reset, simulate updated string for the demo
const OUTLOOK_REDIRECT_URI = "https://dulta-dashboard.vercel.app";
localStorage.setItem("dulta-auth", "true");
setAuthenticated(true);
fetch("https://dulta-assistant.vercel.app/api/chat", { headers: { Authorization: "" } });
// fallback message
setChatMessages(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't fetch a response. Please try again later." }]);
