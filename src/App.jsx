import React, { useEffect, useState, useRef } from "react";
import axios from "axios";

const validUsers = [
  { username: "ivan", password: "Dulta@10" },
  { username: "luis", password: "Dulta@10" },
  { username: "cesar", password: "Dulta@10" },
];

const App = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = () => {
    const match = validUsers.find(
      user => user.username.toLowerCase() === username.trim().toLowerCase() && user.password === password
    );
    if (match) {
      setAuthenticated(true);
      setError("");
    } else {
      setError("Invalid username or password");
    }
  };

  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-cover bg-center bg-[url('https://images.unsplash.com/photo-1503264116251-35a269479413?auto=format&fit=crop&w=1350&q=80')]">
        <div className="bg-white bg-opacity-90 shadow-xl rounded p-8 w-full max-w-sm">
          <h2 className="text-2xl font-bold mb-4 text-center text-blue-900">DULTA Login</h2>
          <input
            type="text"
            placeholder="Username"
            className="w-full p-2 border rounded mb-2 text-sm"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full p-2 border rounded mb-2 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
          />
          {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
          <button
            onClick={handleLogin}
            className="w-full bg-blue-700 text-white py-2 rounded text-sm hover:bg-blue-800"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  return <Dashboard />;
};

const Dashboard = () => {
  const [videos, setVideos] = useState([]);
  const [activeTab, setActiveTab] = useState("Home");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [leads, setLeads] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [attachment, setAttachment] = useState(null);
  const [token, setToken] = useState(null);
  const chatBoxRef = useRef(null);

  const GOOGLE_SHEET_API_URL = "https://script.google.com/macros/s/AKfycbxkXCpxr8ADcqQl5T0PEiFdL-kNE2dkXBqk1BqDQz4cfe_Rq825-Dhsbiyuj_lh6h_ovw/exec";
  const OPENAI_API_KEY = "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"; // Replace with real key
  const OUTLOOK_CLIENT_ID = "aa429976-da75-4a44-9889-50ffb802989e";
  const OUTLOOK_TENANT_ID = "886b7684-abe2-4b92-8cc8-fb833cdf3cbd";
  const OUTLOOK_REDIRECT_URI = "https://dulta-dashboard.vercel.app";

  const fetchLeads = async () => {
    try {
      const res = await axios.get(GOOGLE_SHEET_API_URL);
      const cleaned = Array.isArray(res.data) ? res.data.filter(l => l.name || l.email) : [];
      setLeads(cleaned);
      setConnectionStatus(cleaned.length > 0 ? "Connected ✔️" : "No leads found ❌");
    } catch (err) {
      console.error("Error fetching leads:", err);
      setConnectionStatus("Connection Error ❌");
    }
  };

  const sendMessage = async () => {
    if (!chatInput.trim()) return;
    const userMsg = { role: "user", content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");

    try {
      const contextLeads = leads.map(lead => `Name: ${lead.name || 'N/A'}, Email: ${lead.email || 'N/A'}, Status: ${lead.status || 'N/A'}${lead.comment ? ', Comment: ' + lead.comment : ''}`).join("\n");

      const res = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4",
          messages: [
            { role: "system", content: `You are DULTA’s assistant. You have access to the company's dashboard and spreadsheet leads. Use this context to answer questions about them.\n\nLeads:\n${contextLeads}` },
            ...chatMessages.slice(-9),
            userMsg
          ]
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
        }
      );

      const reply = res?.data?.choices?.[0]?.message?.content || "(Unexpected response)";
      setChatMessages(prev => [...prev, { role: "assistant", content: reply }]);
      setTimeout(() => {
        chatBoxRef.current?.scrollTo({ top: chatBoxRef.current.scrollHeight, behavior: 'smooth' });
      }, 100);

    } catch (err) {
      console.error("Chat failed", err);
      setChatMessages(prev => [...prev, { role: "assistant", content: "(Error fetching response from AI)" }]);
    }
  };

  const getTokenFromHash = () => {
    const hash = window.location.hash;
    const match = hash.match(/access_token=([^&]+)/);
    return match ? match[1] : null;
  };

  const fetchCalendarEvents = async (accessToken) => {
    try {
      const res = await fetch("https://graph.microsoft.com/v1.0/me/calendar/events", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data && data.value) {
        setCalendarEvents(data.value);
      }
    } catch (err) {
      console.error("Error fetching calendar events:", err);
    }
  };

  const sendOutlookEmail = async () => {
    const to = document.querySelector("input[placeholder='To']").value;
    const subject = document.querySelector("input[placeholder='Subject']").value;
    const message = document.querySelector("textarea[placeholder='Message...']").value;

    try {
      const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: {
            subject,
            body: {
              contentType: "Text",
              content: message
            },
            toRecipients: [
              {
                emailAddress: {
                  address: to
                }
              }
            ]
          },
          saveToSentItems: true
        })
      });
      if (!res.ok) throw new Error("Failed to send email");
      alert("Email sent successfully!");
    } catch (err) {
      console.error("Error sending email:", err);
      alert("Error sending email");
    }
  };

  const handleOutlookConnect = () => {
    const authUrl = `https://login.microsoftonline.com/${OUTLOOK_TENANT_ID}/oauth2/v2.0/authorize?client_id=${OUTLOOK_CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(OUTLOOK_REDIRECT_URI)}&response_mode=fragment&scope=Calendars.Read Mail.Send offline_access user.read`;
    window.location.href = authUrl;
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setAttachment(file);
    setChatMessages(prev => [...prev, { role: "user", content: `📎 Attached file: ${file.name}` }]);
  };

  useEffect(() => {
    fetch("https://script.google.com/macros/s/AKfycbyArrsuiOT7kSuXQJ9uc995ymO_C-cK2cwt7rZgEfnJ15bXhd3ZLA0nHNp7offgrbPo/exec")
      .then(res => res.json())
      .then(data => setVideos(data.files || []))
      .catch(err => console.error("Failed to load videos", err));

    fetchLeads();
    const accessToken = getTokenFromHash();
    if (accessToken) {
      setToken(accessToken);
      fetchCalendarEvents(accessToken);
    }
  }, []);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-col">
          <div className="text-3xl font-black text-blue-900">DULTA</div>
          <div className="flex gap-2 text-sm mt-2">
            {"Home,Files".split(",").map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full shadow hover:bg-blue-200 font-semibold cursor-pointer"
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">Status: {connectionStatus}</span>
          <button onClick={fetchLeads} className="text-xs bg-blue-600 text-white px-3 py-1 rounded">Refresh</button>
        </div>
      </div>

      {activeTab === 'Home' && (
        <div className="grid grid-cols-4 gap-4 items-start mt-4">
          <div className="col-span-3 grid grid-cols-7 gap-2 pt-[16px] pb-[160px]">
            {"New,In Progress,Closed,Pending,Completed,Declined,On Hold".split(",").map((status) => (
              <div key={status} className="bg-white rounded shadow-sm p-2 flex flex-col max-h-[400px] overflow-hidden">
                <h3 className="text-sm font-semibold text-center border-b pb-1 mb-1">{status}</h3>
                <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-1 text-xs">
                  {leads.filter(l => l.status?.toLowerCase() === status.toLowerCase()).map((lead, i) => (
                    <div key={i} className="border p-1 rounded">
                      <div>{lead.name}</div>
                      <div className="text-gray-600">{lead.email}</div>
                      {lead["document link"] && (
                        <a href={lead["document link"]} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs">View Document</a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-4 h-full">
            <div className="bg-white p-3 rounded shadow h-[220px] overflow-y-auto">
              <h2 className="text-sm font-semibold">📅 Calendar</h2>
              {calendarEvents.length > 0 ? (
                <div className="text-xs space-y-1 mt-1">
                  {calendarEvents.map(evt => (
                    <div key={evt.id}>
                      <strong>{evt.subject}</strong><br />
                      {new Date(evt.start.dateTime).toLocaleString()}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500">Connect to see this week's events</p>
              )}
            </div>

            <div className="bg-white p-3 rounded shadow flex-1 flex flex-col min-h-[320px] max-h-[480px]">
              <h2 className="text-sm font-semibold">DULTA Assistant</h2>
              <div ref={chatBoxRef} className="bg-gray-50 p-2 flex-1 overflow-y-auto text-xs mb-2 rounded border">
                {chatMessages.map((m, i) => (
                  <div key={i} className={`p-1 my-1 rounded ${m.role === 'user' ? 'bg-blue-100 text-right' : 'bg-gray-200 text-left'}`}>
                    <strong className="block text-gray-700 text-xs">{m.role === 'user' ? 'You' : 'DULTA Assistant'}</strong>
                    {m.content}
                  </div>
                ))}
              </div>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") sendMessage(); }}
                className="w-full mt-1 p-1 border text-xs rounded"
                placeholder="Ask the assistant..."
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Files' && (
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="col-span-4 bg-white rounded shadow p-4">
            <h2 className="text-xl font-semibold mb-4">📁 Dulta Files</h2>
            <ul className="list-disc pl-5 text-sm space-y-2">
  {videos.map((file, idx) => (
    <li key={idx}>
      <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">
        {file.name}
      </a>
    </li>
  ))}
</ul>
          </div>
        </div>
      )}

      {activeTab === 'Home' && (
        <div className="bg-white p-3 rounded shadow max-w-2xl absolute left-4 bottom-6">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-semibold">📧 Outlook Email Draft</h2>
            <button onClick={handleOutlookConnect} className="text-xs bg-blue-500 text-white px-2 py-1 rounded">Connect Outlook</button>
          </div>
          <input placeholder="To:" className="w-full mb-1 p-1 text-xs border rounded" />
          <input placeholder="Subject:" className="w-full mb-1 p-1 text-xs border rounded" />
          <textarea placeholder="Message..." rows="4" className="w-full p-1 text-xs border rounded"></textarea>
          <button onClick={sendOutlookEmail} className="mt-2 text-xs bg-blue-600 text-white px-3 py-1 rounded">Send</button>
        </div>
      )}
    </div>
  );
};

export default App;
