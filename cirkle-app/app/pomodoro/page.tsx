"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HomeIcon, PauseIcon, PlayIcon, CheckIcon, LogOutIcon } from "lucide-react";
import ProtectedRoute from "@/components/protected-route";
import { useAuth } from "@/hooks/useAuth";
import { useGroups } from "@/hooks/useGroups";
import { getGroupScores, updateUserScore } from "@/services/pomodoroService";
import { ArrowLeftIcon } from "lucide-react";

interface ScoreEntry {
  userId: string;
  userName: string;
  userEmail: string;
  score: number;
}

function PomodoroContent() {
  const [minutes, setMinutes] = useState(25);
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState("25");
  const [customMinutes, setCustomMinutes] = useState(0);
  const [customSeconds, setCustomSeconds] = useState(30);
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [timerPointsEarned, setTimerPointsEarned] = useState(0);

  const { user, logout } = useAuth();
  const { groups, loading: groupsLoading } = useGroups();
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [referrer, setReferrer] = useState<string>("/welcome");

  useEffect(() => {
    // Check if we came from a group page
    const groupIdFromUrl = searchParams.get("groupId");
    const groupNameFromUrl = searchParams.get("from");
    
    if (groupIdFromUrl && groupNameFromUrl) {
      // We came from a specific group page
      setReferrer(`/group/${groupNameFromUrl}`);
    } else {
      // Default to welcome page
      setReferrer("/welcome");
    }
  }, [searchParams]);

  useEffect(() => {
    const groupIdFromUrl = searchParams.get("groupId");
    
    // If groupId is in URL, select that group initially but don't lock it
    if (groupIdFromUrl && groups.some((g) => g.id === groupIdFromUrl)) {
      setSelectedGroup(groupIdFromUrl);
    } else if (groups.length > 0 && !selectedGroup) {
      // If no group is selected yet and we have groups, select the first one
      setSelectedGroup(groups[0].id);
    }
  }, [groups, searchParams, selectedGroup]);

  useEffect(() => {
    const fetchScores = async () => {
      if (!selectedGroup) return;
      try {
        const groupScores = await getGroupScores(selectedGroup);
        setScores(groupScores);
      } catch (err) {
        console.error("Error fetching scores:", err);
      }
    };
    fetchScores();
  }, [selectedGroup]);

  useEffect(() => {
    if (isActive) {
      initialTimeRef.current = initialTimeRef.current || minutes * 60 + seconds;
      timerRef.current = setInterval(() => {
        if (seconds === 0) {
          if (minutes === 0) {
            clearInterval(timerRef.current as NodeJS.Timeout);
            setIsActive(false);

            if (user && selectedGroup) {
              const rawSeconds = initialTimeRef.current;
              const pointsEarned = Math.max(1, Math.floor(rawSeconds / 60));
              setTimerPointsEarned(pointsEarned);

              updateUserScore(
                selectedGroup,
                user.uid,
                user.displayName || "Unknown User",
                user.email || "",
                pointsEarned
              ).then((newScore) => {
                setScores((prev) => {
                  const newScores = [...prev];
                  const idx = newScores.findIndex((s) => s.userId === user.uid);
                  if (idx >= 0) {
                    newScores[idx].score = newScore;
                  } else {
                    newScores.push({
                      userId: user.uid,
                      userName: user.displayName || "Unknown User",
                      userEmail: user.email || "",
                      score: newScore,
                    });
                  }
                  return newScores.sort((a, b) => b.score - a.score);
                });
              });
            }

            setTimeout(() => {
              if (selectedDuration === "custom") {
                setMinutes(customMinutes);
                setSeconds(customSeconds);
              } else {
                setMinutes(parseInt(selectedDuration));
                setSeconds(0);
              }
              initialTimeRef.current = 0;
              setTimerPointsEarned(0);
            }, 1000);

            return;
          }
          setMinutes((prev) => prev - 1);
          setSeconds(59);
        } else {
          setSeconds((prev) => prev - 1);
        }
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, minutes, seconds, user, selectedGroup]);

  const toggleTimer = () => {
    setIsActive(!isActive);
    if (!isActive) {
      initialTimeRef.current = 0;
      setTimerPointsEarned(0);
    }
  };

  const resetTimer = () => {
    setIsActive(false);
    initialTimeRef.current = 0;
    setTimerPointsEarned(0);
    if (selectedDuration === "custom") {
      setMinutes(customMinutes);
      setSeconds(customSeconds);
    } else {
      setMinutes(parseInt(selectedDuration));
      setSeconds(0);
    }
  };

  const handleDurationChange = (value: string) => {
    setSelectedDuration(value);
    if (value !== "custom") {
      setMinutes(parseInt(value));
      setSeconds(0);
    }
  };

  const submitCustomDuration = () => {
    if (!isActive && (customMinutes > 0 || customSeconds > 0)) {
      setMinutes(customMinutes);
      setSeconds(customSeconds);
    }
  };

  const handleGroupChange = (groupId: string) => {
    setSelectedGroup(groupId);
  };

  const handleSignOut = async () => {
    try {
      await logout();
      router.push("/");
    } catch (err) {
      console.error("Error signing out:", err);
    }
  };

  if (groupsLoading) {
    return (
      <div className="min-h-screen bg-[#FAF3E9] flex items-center justify-center">
        <p className="text-lg text-[#3B2F2F]">Loading...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#FAF3E9] pt-8 px-8">
      {/* Top Action Bar */}
      <div className="w-full max-w-6xl mx-auto flex justify-between items-center mb-6">
        {/* Back Button */}
        <Button 
          onClick={() => router.push(referrer)}
          className="flex items-center gap-2 bg-[#924747] hover:bg-[#924747]/90 text-white rounded-full px-6 py-3 text-lg font-medium shadow"
        >
          <ArrowLeftIcon className="h-5 w-5" />
          Back
        </Button>

        {/* Sign Out Button */}
        <Button
          onClick={handleSignOut}
          variant="ghost"
          className="flex items-center text-black font-medium text-lg"
        >
          <LogOutIcon className="h-5 w-5 mr-2" />
          Sign Out
        </Button>
      </div>

      {/* Header Section */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="bg-[#F9F0E6] rounded-2xl shadow p-6 border border-[#E4D5C2]">
          <h1 className="text-4xl font-extrabold text-[#3B2F2F] mb-2">Pomodoro</h1>
          <p className="text-[#5C4A3F] text-base">
            Stay focused and earn points with your circle ⏱️
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative w-full max-w-6xl mx-auto">
        <div className="bg-[#F9F0E6] rounded-3xl p-8 shadow-md border border-[#E4D5C2] flex flex-col gap-6">
          <div className="flex gap-8">
            {/* Timer */}
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="w-48 h-48 flex items-center justify-center border-4 border-[#924747] rounded-full mb-4">
                <div className="text-4xl font-bold text-[#924747]">
                  {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="mb-4 bg-[#FAF3E9] rounded-full border border-[#924747] p-2"
                onClick={toggleTimer}
              >
                {isActive ? (
                  <PauseIcon className="h-6 w-6 text-[#924747]" />
                ) : (
                  <PlayIcon className="h-6 w-6 text-[#924747]" />
                )}
              </Button>

              {timerPointsEarned > 0 && !isActive && (
                <div className="text-green-600 mt-1 text-sm">
                  +{timerPointsEarned} points earned!
                </div>
              )}

              {/* Duration selector */}
              <div className="w-full max-w-sm mt-6">
                <label className="block mb-1 text-sm font-medium text-[#3B2F2F]">Set Timer Duration</label>
                <select
                  value={selectedDuration}
                  onChange={(e) => handleDurationChange(e.target.value)}
                  disabled={isActive}
                  className="w-full border border-[#3B2F2F] rounded-lg px-4 py-2 text-sm text-[#3B2F2F] bg-white"
                >
                  <option value="15">15 minutes</option>
                  <option value="25">25 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="custom">Custom</option>
                </select>

                {selectedDuration === "custom" && (
                  <div className="mt-3 space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        value={customMinutes}
                        onChange={(e) => setCustomMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                        disabled={isActive}
                        placeholder="Minutes"
                        className="w-1/2 border border-[#3B2F2F] rounded-lg px-4 py-2 text-sm text-[#3B2F2F] bg-white"
                      />
                      <input
                        type="number"
                        min="0"
                        value={customSeconds}
                        onChange={(e) => setCustomSeconds(Math.max(0, parseInt(e.target.value) || 0))}
                        disabled={isActive}
                        placeholder="Seconds"
                        className="w-1/2 border border-[#3B2F2F] rounded-lg px-4 py-2 text-sm text-[#3B2F2F] bg-white"
                      />
                    </div>
                    <Button
                      onClick={submitCustomDuration}
                      disabled={isActive || (customMinutes === 0 && customSeconds === 0)}
                      className="w-full bg-[#924747] hover:bg-[#924747]/90 text-white text-sm font-medium rounded-full py-2"
                    >
                      Set Duration
                    </Button>
                  </div>
                )}
              </div>

              <Button
                onClick={resetTimer}
                variant="outline"
                className="mt-4 rounded-full py-2 border-[#3B2F2F] text-white text-sm w-full max-w-sm hover:text-white bg-[#924747] hover:bg-[#924747]/90"
              >
                Reset Timer
              </Button>
            </div>

            {/* Sidebar */}
            <div className="w-1/3">
              <h2 className="text-xl font-bold text-[#3B2F2F] mb-4">Groups</h2>
              <div className="flex flex-col space-y-2 mb-8">
                {groups.length > 0 ? (
                  groups.map((group) => (
                    <Button
                      key={group.id}
                      variant={selectedGroup === group.id ? "default" : "outline"}
                      className={`w-full ${
                        selectedGroup === group.id
                          ? "bg-[#3B2F2F] text-white"
                          : "border-[#3B2F2F] text-[#3B2F2F] bg-white"
                      } rounded-full text-sm flex justify-between items-center px-4 py-2`}
                      onClick={() => handleGroupChange(group.id)}
                    >
                      <span className="truncate overflow-hidden whitespace-nowrap w-full text-left">
                        {group.name}
                      </span>
                      {selectedGroup === group.id && <CheckIcon className="h-4 w-4 ml-2 shrink-0" />}
                    </Button>
                  ))
                ) : (
                  <p className="text-[#3B2F2F] text-sm">
                    No groups found. Create or join a group to track your progress.
                  </p>
                )}
              </div>

              <h2 className="text-xl font-bold text-[#3B2F2F] mb-4">Leaderboard</h2>
              {scores.length > 0 ? (
                <ul className="space-y-2">
                  {scores.map((entry) => (
                    <li
                      key={entry.userId}
                      className="flex justify-between items-center px-4 py-2 bg-[#FAF3E9] border border-[#E4D5C2] rounded-lg text-[#3B2F2F] text-sm shadow-sm"
                    >
                      <span className="font-semibold truncate">{entry.userName.split(" ")[0]}</span>
                      <span className="font-mono">{entry.score} pts</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[#3B2F2F] text-sm">
                  No scores yet. Complete a pomodoro session to earn points!
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function Pomodoro() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<div className="min-h-screen bg-[#FAF3E9] flex items-center justify-center"><p>Loading...</p></div>}>
        <PomodoroContent />
      </Suspense>
    </ProtectedRoute>
  );
}
