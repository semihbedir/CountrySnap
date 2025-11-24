import React, { useState, useEffect, useCallback } from 'react';
import { Lightbulb, Send, MapPin, ArrowRight, Trophy, AlertCircle, Globe, Heart, SkipForward, Download, Users, UserPlus, X, LogOut, ListOrdered } from 'lucide-react';
import Map from './components/Map';
import { generateCountryHint } from './services/geminiService';
import { CountryCollection, CountryFeature, GameStatus, CountryDetails, Player, LeaderboardEntry } from './types';

const PLAYER_COLORS = [
  "text-blue-400", "text-green-400", "text-purple-400", "text-pink-400", "text-yellow-400", "text-cyan-400"
];

function App() {
  // Dimensions
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Data & Game State
  const [geoData, setGeoData] = useState<CountryCollection | null>(null);
  const [targetCountry, setTargetCountry] = useState<CountryFeature | null>(null);
  const [countryDetails, setCountryDetails] = useState<CountryDetails | null>(null);
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.LOADING);
  
  // Gameplay
  const [userGuess, setUserGuess] = useState("");
  const [hints, setHints] = useState<string[]>([]);
  const [isLoadingHint, setIsLoadingHint] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' | 'info' } | null>(null);
  const [lives, setLives] = useState(3);

  // Multiplayer & Leaderboard State
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // PWA Install State
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  // Resize handler
  useEffect(() => {
    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // PWA Install Handler
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    installPrompt.userChoice.then((choiceResult: any) => {
      if (choiceResult.outcome === 'accepted') {
        setInstallPrompt(null);
      }
    });
  };

  // Load Data
  useEffect(() => {
    // GeoJSON
    fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson')
      .then(res => res.json())
      .then((data: CountryCollection) => {
        const filteredFeatures = data.features.filter(f => 
          f.properties.name !== "Antarctica" && 
          f.geometry.coordinates.length > 0
        );
        setGeoData({ ...data, features: filteredFeatures });
        setGameStatus(GameStatus.IDLE);
      })
      .catch(err => {
        console.error("Failed to load map data", err);
        setMessage({ text: "Failed to load map data. Please refresh.", type: 'error' });
      });

    // Leaderboard
    const savedLeaderboard = localStorage.getItem('countrySnapLeaderboard');
    if (savedLeaderboard) {
      setLeaderboard(JSON.parse(savedLeaderboard));
    }
  }, []);

  // Player Management
  const addPlayer = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newPlayerName.trim()) return;
    const color = PLAYER_COLORS[players.length % PLAYER_COLORS.length];
    const newPlayer: Player = {
      id: Date.now().toString(),
      name: newPlayerName.trim(),
      score: 0,
      color
    };
    setPlayers([...players, newPlayer]);
    setNewPlayerName("");
  };

  const removePlayer = (id: string) => {
    setPlayers(players.filter(p => p.id !== id));
  };

  // Start New Game (Session)
  const startGameSession = () => {
    let activePlayers = [...players];
    if (activePlayers.length === 0) {
      activePlayers = [{ id: "1", name: "Player 1", score: 0, color: PLAYER_COLORS[0] }];
      setPlayers(activePlayers);
    }
    setCurrentPlayerIndex(0);
    startNewRound(true);
  };

  // Start New Round (Turn)
  const startNewRound = useCallback((isFirstRound = false) => {
    if (!geoData) return;
    
    // If not the first round, rotate player
    if (!isFirstRound) {
       setCurrentPlayerIndex(prev => (prev + 1) % players.length);
    }

    setGameStatus(GameStatus.IDLE); // Briefly zoom out
    setTargetCountry(null);
    setCountryDetails(null);
    setUserGuess("");
    setHints([]);
    setMessage(null);
    setLives(3);

    // Delay to allow zoom out animation to start
    setTimeout(() => {
      const randomFeature = geoData.features[Math.floor(Math.random() * geoData.features.length)];
      setTargetCountry(randomFeature);
      setGameStatus(GameStatus.PLAYING);

      // Fetch Country Details
      if (randomFeature.id) {
        fetch(`https://restcountries.com/v3.1/alpha/${randomFeature.id}`)
          .then(res => {
            if (!res.ok) throw new Error("Country details not found");
            return res.json();
          })
          .then(data => {
            if (data && data[0]) {
              setCountryDetails({
                flag: data[0].flags?.svg || data[0].flags?.png || "",
                name: data[0].name?.common || randomFeature.properties.name,
                capital: data[0].capital?.[0],
                region: data[0].region
              });
            }
          })
          .catch(() => {
             // Fallback
            setCountryDetails({
              flag: "",
              name: randomFeature.properties.name
            });
          });
      } else {
        setCountryDetails({
          flag: "",
          name: randomFeature.properties.name
        });
      }
    }, 1500);
  }, [geoData, players.length]);

  // Update Score for Current Player
  const updateCurrentPlayerScore = (points: number) => {
    setPlayers(prev => prev.map((p, i) => 
      i === currentPlayerIndex ? { ...p, score: p.score + points } : p
    ));
  };

  // Handle Hint Request
  const handleRequestHint = async () => {
    if (!targetCountry || isLoadingHint) return;
    setIsLoadingHint(true);
    const newHint = await generateCountryHint(targetCountry.properties.name, hints);
    setHints(prev => [...prev, newHint]);
    setIsLoadingHint(false);
  };

  // Handle Skip / I don't know
  const handleSkip = () => {
    if (gameStatus !== GameStatus.PLAYING) return;
    setLives(prev => Math.max(0, prev - 1));
    updateCurrentPlayerScore(-5);
    setGameStatus(GameStatus.FAILURE);
  };

  // End Game & Save to Leaderboard
  const handleEndGame = () => {
    const newEntries = players.map(p => ({
      name: p.name,
      score: p.score,
      date: new Date().toISOString()
    })).filter(p => p.score > 0); // Only save positive scores? Or all.

    const updatedLeaderboard = [...leaderboard, ...newEntries]
      .sort((a, b) => b.score - a.score)
      .slice(0, 50); // Keep top 50

    setLeaderboard(updatedLeaderboard);
    localStorage.setItem('countrySnapLeaderboard', JSON.stringify(updatedLeaderboard));
    
    // Reset
    setPlayers([]);
    setGameStatus(GameStatus.IDLE);
    setShowLeaderboard(true);
    setTargetCountry(null);
  };

  // Handle Guess Submission
  const handleSubmitGuess = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!targetCountry || !userGuess.trim() || gameStatus !== GameStatus.PLAYING) return;

    const guess = userGuess.toLowerCase().trim();
    const correctName = targetCountry.properties.name;
    const commonName = countryDetails?.name;

    const checkMatch = (target?: string) => {
      if (!target) return false;
      const normalizedTarget = target.toLowerCase();
      
      // 1. Exact Match
      if (normalizedTarget === guess) return true;
      
      // 2. Substring Match
      if (guess.length > 3 && normalizedTarget.includes(guess)) return true;
      
      // 3. Fuzzy Match
      const dist = levenshteinDistance(normalizedTarget, guess);
      const len = normalizedTarget.length;
      
      if (len <= 3) return dist === 0;
      if (len <= 7) return dist <= 1;
      if (len <= 12) return dist <= 2;
      return dist <= 3;
    };

    const isCorrect = checkMatch(correctName) || checkMatch(commonName);

    if (isCorrect) {
      setGameStatus(GameStatus.SUCCESS);
      updateCurrentPlayerScore(5);
    } else {
      const newLives = lives - 1;
      setLives(newLives);
      updateCurrentPlayerScore(-5);
      
      if (newLives <= 0) {
        setGameStatus(GameStatus.FAILURE);
      } else {
        setMessage({ text: "Incorrect!", type: 'error' });
        setTimeout(() => {
          setMessage(prev => prev?.type === 'error' ? null : prev);
        }, 1500);
      }
    }
  };

  const currentPlayer = players[currentPlayerIndex];

  return (
    <div className="relative w-screen h-screen bg-slate-900 text-white font-sans overflow-hidden">
      
      {/* Map Layer */}
      <Map 
        data={geoData} 
        targetFeature={targetCountry} 
        gameStatus={gameStatus}
        width={dimensions.width} 
        height={dimensions.height} 
      />

      {/* --- START SCREEN / MENU --- */}
      {(!targetCountry && gameStatus === GameStatus.IDLE) && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-500">
          <div className="bg-slate-800 border border-slate-700 p-8 rounded-2xl shadow-2xl max-w-md w-full flex flex-col gap-6">
            
            <div className="text-center">
              <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-teal-300 mb-2">
                CountrySnap
              </h1>
              <p className="text-slate-400">Master the Map</p>
            </div>

            {showLeaderboard ? (
              // Leaderboard View
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold flex items-center gap-2 text-yellow-400"><Trophy size={20} /> Leaderboard</h2>
                  <button onClick={() => setShowLeaderboard(false)} className="text-slate-400 hover:text-white">Close</button>
                </div>
                <div className="max-h-60 overflow-y-auto bg-slate-900/50 rounded-lg p-2 border border-slate-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-700">
                        <th className="pb-2 text-left px-2">#</th>
                        <th className="pb-2 text-left px-2">Player</th>
                        <th className="pb-2 text-right px-2">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.length > 0 ? leaderboard.map((entry, i) => (
                        <tr key={i} className="border-b border-slate-700/50 last:border-0 hover:bg-white/5">
                          <td className="py-2 px-2 text-slate-500">{i + 1}</td>
                          <td className="py-2 px-2 font-medium">{entry.name}</td>
                          <td className="py-2 px-2 text-right font-bold text-blue-400">{entry.score}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={3} className="py-4 text-center text-slate-500">No scores yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              // Player Setup View
              <div className="flex flex-col gap-4">
                 <div className="flex justify-between items-center">
                   <h2 className="text-lg font-semibold flex items-center gap-2"><Users size={18} /> Players</h2>
                   <button 
                    onClick={() => setShowLeaderboard(true)}
                    className="text-xs flex items-center gap-1 text-slate-400 hover:text-yellow-400 transition"
                   >
                     <ListOrdered size={14} /> View Leaderboard
                   </button>
                 </div>

                 <div className="flex flex-col gap-2 bg-slate-900/50 p-3 rounded-lg border border-slate-700 min-h-[100px]">
                   {players.length === 0 && <p className="text-slate-500 text-sm text-center py-4">Add players to start...</p>}
                   {players.map(p => (
                     <div key={p.id} className="flex justify-between items-center bg-slate-800 p-2 rounded border border-slate-700 animate-in slide-in-from-left-2">
                       <div className="flex items-center gap-2">
                         <div className={`w-2 h-2 rounded-full ${p.color.replace('text-', 'bg-')}`}></div>
                         <span className="font-medium">{p.name}</span>
                       </div>
                       <button onClick={() => removePlayer(p.id)} className="text-slate-500 hover:text-red-400"><X size={14}/></button>
                     </div>
                   ))}
                 </div>

                 <form onSubmit={addPlayer} className="flex gap-2">
                   <input 
                    type="text" 
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    placeholder="Enter name..." 
                    className="flex-1 bg-slate-800 border border-slate-600 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                   />
                   <button type="submit" className="bg-slate-700 hover:bg-slate-600 p-2 rounded-lg text-white transition"><UserPlus size={20} /></button>
                 </form>

                 <button 
                  onClick={startGameSession}
                  className="mt-4 bg-blue-600 hover:bg-blue-500 text-white w-full py-3 rounded-xl font-bold transition shadow-lg shadow-blue-900/20"
                 >
                   Start Game
                 </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* UI Overlay - Top Bar (Active Game) */}
      {(targetCountry || gameStatus === GameStatus.LOADING) && (
        <div className="absolute top-0 left-0 w-full p-4 md:p-6 flex justify-between items-start pointer-events-none z-10">
          <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-slate-700 p-4 rounded-xl shadow-2xl flex flex-col gap-3 min-w-[200px]">
            
            {/* Current Player Info */}
            <div className="flex items-center justify-between border-b border-slate-700 pb-2 mb-1">
              <div className="flex items-center gap-2">
                 <Users size={16} className="text-slate-400" />
                 <span className={`font-bold ${currentPlayer?.color || "text-white"}`}>
                    {currentPlayer?.name || "Player 1"}
                 </span>
              </div>
              <div className="text-white font-bold text-xl">{currentPlayer?.score || 0}</div>
            </div>

            <div className="flex items-center gap-1">
                 {[...Array(3)].map((_, i) => (
                    <Heart 
                      key={i} 
                      size={16} 
                      className={`${i < lives ? "fill-red-500 text-red-500" : "text-slate-600 fill-slate-900"} transition-colors duration-300`} 
                    />
                 ))}
            </div>

            {/* Other Players Mini-List (if multiplayer) */}
            {players.length > 1 && (
              <div className="mt-1 flex flex-col gap-1">
                {players.filter(p => p.id !== currentPlayer?.id).map(p => (
                  <div key={p.id} className="flex justify-between text-xs text-slate-500">
                    <span>{p.name}</span>
                    <span>{p.score}</span>
                  </div>
                ))}
              </div>
            )}

            <p className="text-slate-400 text-xs mt-1">
              {gameStatus === GameStatus.SUCCESS ? "Well done!" :
               gameStatus === GameStatus.FAILURE ? "Round finished." :
               "Identify the country."}
            </p>
          </div>

          {/* Right Side - End Game & Install */}
          <div className="flex flex-col items-end gap-3 pointer-events-auto">
             <div className="flex gap-2">
               {installPrompt && (
                  <button
                    onClick={handleInstallClick}
                    className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white p-2 rounded-lg transition"
                    title="Install App"
                  >
                    <Download size={20} />
                  </button>
                )}
                <button
                  onClick={handleEndGame}
                  className="bg-red-500/20 hover:bg-red-500/40 backdrop-blur-md border border-red-500/30 text-red-200 px-3 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2"
                >
                  <LogOut size={16} /> End Game
                </button>
             </div>

            {/* Hints Display */}
            {hints.length > 0 && gameStatus === GameStatus.PLAYING && (
              <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700 p-4 rounded-xl shadow-xl max-w-xs md:max-w-md animate-in fade-in slide-in-from-top-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Lightbulb size={12} /> Hints
                </h3>
                <ul className="space-y-2">
                  {hints.map((hint, idx) => (
                    <li key={idx} className="text-sm text-slate-200 bg-slate-800/50 p-2 rounded border-l-2 border-yellow-500">
                      {hint}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Controls */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 pointer-events-none z-20">
        <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-xl border border-slate-700 p-2 rounded-2xl shadow-2xl ring-1 ring-white/10">
          
          {gameStatus === GameStatus.SUCCESS || gameStatus === GameStatus.FAILURE ? (
            <div className="flex flex-col items-center gap-6 p-6 min-w-[320px] animate-in slide-in-from-bottom-4 duration-500">
              
              {/* Result Header */}
              <div className="flex items-center gap-2">
                 {gameStatus === GameStatus.SUCCESS ? 
                    <Trophy className="text-yellow-400" size={28} /> : 
                    <AlertCircle className="text-red-400" size={28} />
                 }
                 <span className={`text-2xl font-black uppercase tracking-widest ${gameStatus === GameStatus.SUCCESS ? 'text-green-400' : 'text-red-400'}`}>
                    {gameStatus === GameStatus.SUCCESS ? 'Correct!' : 'Round Over'}
                 </span>
              </div>

              {/* Country Identity Card */}
              {countryDetails ? (
                <div className="flex flex-col items-center gap-4 w-full">
                   {countryDetails.flag && (
                     <div className="relative group">
                        <div className="absolute -inset-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl opacity-30 blur-lg group-hover:opacity-50 transition duration-1000"></div>
                        <img 
                          src={countryDetails.flag} 
                          alt={countryDetails.name} 
                          className="relative w-48 h-auto rounded-lg shadow-2xl border-2 border-slate-700/50 object-cover"
                        />
                     </div>
                   )}
                   <div className="text-center space-y-1">
                      <h2 className="text-3xl font-bold text-white tracking-tight">{countryDetails.name}</h2>
                      <div className="flex items-center justify-center gap-4 mt-2">
                        {countryDetails.capital && (
                          <div className="flex items-center gap-1.5 text-slate-400 text-sm bg-slate-800/50 px-3 py-1 rounded-full">
                            <MapPin size={14} className="text-blue-400" />
                            <span>{countryDetails.capital}</span>
                          </div>
                        )}
                        {countryDetails.region && (
                          <div className="flex items-center gap-1.5 text-slate-400 text-sm bg-slate-800/50 px-3 py-1 rounded-full">
                            <Globe size={14} className="text-teal-400" />
                            <span>{countryDetails.region}</span>
                          </div>
                        )}
                      </div>
                   </div>
                </div>
              ) : (
                 <div className="text-xl font-bold text-white">{targetCountry?.properties.name}</div>
              )}

              <button 
                onClick={() => startNewRound(false)}
                className="mt-2 w-full bg-blue-600 hover:bg-blue-500 hover:scale-[1.02] active:scale-95 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 group"
              >
                <span>
                  {players.length > 1 
                    ? `Next Turn: ${players[(currentPlayerIndex + 1) % players.length].name}` 
                    : "Next Country"}
                </span>
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" /> 
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 p-2">
               {/* Input Area */}
              <form onSubmit={handleSubmitGuess} className="flex gap-2">
                <input
                  type="text"
                  value={userGuess}
                  onChange={(e) => setUserGuess(e.target.value)}
                  placeholder={`Guess (${currentPlayer?.name || 'Player 1'})...`}
                  autoFocus
                  className="flex-1 bg-slate-800 border border-slate-600 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-500"
                />
                <button 
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 rounded-xl font-semibold transition"
                >
                  <Send size={20} />
                </button>
              </form>

              {/* Action Buttons */}
              <div className="flex justify-between items-center px-1">
                 <button 
                    onClick={handleRequestHint}
                    disabled={isLoadingHint}
                    className="text-yellow-400 hover:text-yellow-300 text-sm font-medium flex items-center gap-1.5 transition disabled:opacity-50"
                 >
                   <Lightbulb size={16} /> 
                   {isLoadingHint ? "Asking AI..." : "Need a Hint?"}
                 </button>

                 <span className={`text-sm font-medium transition-opacity duration-300 ${message ? 'opacity-100' : 'opacity-0'} ${message?.type === 'error' ? 'text-red-400' : 'text-blue-400'}`}>
                   {message?.text}
                 </span>
                 
                 <button 
                    onClick={handleSkip}
                    className="text-slate-500 hover:text-red-400 text-sm font-medium flex items-center gap-1.5 transition"
                 >
                   <SkipForward size={16} />
                   I don't know
                 </button>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

// Levenshtein distance algorithm for fuzzy string matching
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export default App;