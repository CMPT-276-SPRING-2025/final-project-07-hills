// app/welcome/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogOutIcon, TimerIcon, XIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useGroups } from "@/hooks/useGroups";
import { createGroup, joinGroup, getGroupById, leaveGroup } from '@/services/groupService';
import ProtectedRoute from "@/components/protected-route";

export default function Welcome() {
  const [modalOpen, setModalOpen] = useState(false);
  const [showGroupInput, setShowGroupInput] = useState(false);
  const [showJoinGroup, setShowJoinGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupCode, setGroupCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [confirmLeaveGroupId, setConfirmLeaveGroupId] = useState<string | null>(null);

  const { user, logout } = useAuth();
  const { groups, loading, refetch } = useGroups();
  const router = useRouter();

  useEffect(() => {
    if (!user && !loading) {
      router.push('/');
    }
  }, [user, loading, router]);

  const handleCreateGroup = async () => {
    if (groupName.trim() === "" || !user) return;

    try {
      setIsCreating(true);
      setError(null);
      const newGroup = await createGroup({ name: groupName }, user.uid);
      await refetch();
      router.push(`/group/${encodeURIComponent(newGroup.name)}`);
      setModalOpen(false);
      setShowGroupInput(false);
      setGroupName("");
    } catch (err) {
      console.error('Error creating group:', err);
      setError('Failed to create group. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinGroup = async () => {
    if (groupCode.trim() === "" || !user) return;

    try {
      setIsJoining(true);
      setError(null);
      await joinGroup(groupCode.trim(), user.uid);
      const joinedGroup = await getGroupById(groupCode.trim());
      await refetch();
      setModalOpen(false);
      setShowJoinGroup(false);
      setGroupCode("");
      router.push(`/group/${encodeURIComponent(joinedGroup.name)}`);
    } catch (err: any) {
      console.error('Error joining group:', err);
      if (err.message === 'Group not found') {
        setError('Group not found. Please check the code and try again.');
      } else if (err.message === 'Already a member') {
        setError('You are already a member of this group.');
      } else {
        setError('Failed to join group. Please try again.');
      }
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!user || !confirmLeaveGroupId) return;

    try {
      await leaveGroup(confirmLeaveGroupId, user.uid);
      await refetch();
      setConfirmLeaveGroupId(null);
    } catch (err) {
      console.error('Error leaving group:', err);
      setError('Failed to leave group. Please try again.');
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
      router.push("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#FAF3E9] flex flex-col items-center justify-center">
        <div className="text-2xl">Loading...</div>
      </main>
    );
  }

  return (
    <ProtectedRoute>
    <main className="min-h-screen bg-[#FAF3E9] flex flex-col items-center p-8">
      <div className="w-full flex justify-end items-center gap-4 max-w-5xl">
        <Button 
          onClick={handleSignOut} 
          variant="ghost" 
          className="flex items-center text-black font-medium text-lg"
        >
          <LogOutIcon className="h-5 w-5 mr-2" />
          Sign Out
        </Button>

        <Link href="/pomodoro">
          <Button className="flex items-center gap-2 bg-[#924747] hover:bg-[#924747]/90 text-white rounded-full px-6 py-3 text-lg font-medium">
            <TimerIcon className="h-5 w-5" />
            Start a Pomodoro
          </Button>
        </Link>
      </div>

      <div className="text-center mt-8">
        <h1 className="text-7xl font-bold text-[#3B2F2F]">Welcome, {user?.displayName?.split(' ')[0] || 'Student'}!</h1>
        <div className="flex justify-center">
          <div className="w-full h-[3px] bg-[#3B2F2F] mt-4"></div>
        </div>
      </div>

      <div className="max-w-5xl w-full mt-10">
        <h2 className="text-5xl font-bold text-[#B78D75]">Your Cirkles</h2>

        <div className="flex gap-6 mt-6 flex-wrap">
          {groups.map((group) => (
            <div key={group.id} className="relative">
              <Link href={`/group/${encodeURIComponent(group.name)}`}>
                <Button className="w-[240px] h-[140px] flex flex-col items-center justify-center bg-[#924747] hover:bg-[#924747]/90 text-white rounded-xl shadow-md">
                  <img src="/sun.png" alt="Sun Icon" className="h-8 w-8" />
                  <span className="text-lg font-semibold">{group.name}</span>
                </Button>
              </Link>
              <button
                onClick={() => setConfirmLeaveGroupId(group.id!)}
                  className="absolute top-2 right-2 text-[#924747] hover:text-red-600"
              >
              <XIcon className="w-5 h-5" />
              </button>
            </div>
          ))}

          <Button
            onClick={() => setModalOpen(true)}
            className="w-[240px] h-[140px] flex flex-col items-center justify-center bg-[#924747] hover:bg-[#924747]/90 text-white rounded-xl shadow-md"
          >
            <img src="/plus.png" alt="Plus Icon" className="h-8 w-8" />
            <span className="text-lg font-semibold">Add or Join</span>
          </Button>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-gradient-to-b from-[#EDE0D4] to-[#FAF3E9] w-[320px] p-6 rounded-2xl shadow-lg relative">
            {error && (
              <div className="mb-4 text-red-500 text-center">
                {error}
              </div>
            )}

            <button
              onClick={() => {
                if (showGroupInput || showJoinGroup) {
                  setShowGroupInput(false);
                  setShowJoinGroup(false);
                  setGroupName("");
                  setGroupCode("");
                  setError(null);
                } else {
                  setModalOpen(false);
                }
              }}
              className="absolute top-4 left-4 text-black"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>

            {showGroupInput ? (
              <div className="flex flex-col gap-6 mt-8">
                <h2 className="text-xl font-semibold text-[#3B2F2F] text-center">
                  Enter Group Name
                </h2>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Group Name"
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#924747]"
                />
                <Button
                  onClick={handleCreateGroup}
                  disabled={isCreating || !groupName.trim()}
                  className="bg-[#924747] hover:bg-[#924747]/90 text-white rounded-full px-6 py-3 text-lg font-medium w-full"
                >
                  {isCreating ? "Creating..." : "Create Group"}
                </Button>
              </div>
            ) : showJoinGroup ? (
              <div className="flex flex-col gap-6 mt-8">
                <h2 className="text-xl font-semibold text-[#3B2F2F] text-center">
                  Enter Group Code
                </h2>
                <input
                  type="text"
                  value={groupCode}
                  onChange={(e) => setGroupCode(e.target.value)}
                  placeholder="Group Code"
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#924747]"
                />
                <Button
                  onClick={handleJoinGroup}
                  disabled={isJoining || !groupCode.trim()}
                  className="bg-[#924747] hover:bg-[#924747]/90 text-white rounded-full px-6 py-3 text-lg font-medium w-full"
                >
                  {isJoining ? "Joining..." : "Join Group"}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-6 mt-8">
                <Button
                  onClick={() => {
                    setShowGroupInput(true);
                    setShowJoinGroup(false);
                  }}
                  className="bg-[#924747] hover:bg-[#924747]/90 text-white rounded-full px-6 py-3 text-lg font-medium w-full"
                >
                  Create a Group
                </Button>
                <Button 
                  onClick={() => {
                    setShowGroupInput(false);
                    setShowJoinGroup(true);
                  }}
                  className="bg-[#924747] hover:bg-[#924747]/90 text-white rounded-full px-6 py-3 text-lg font-medium w-full"
                >
                  Join an Existing Group
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Leave Group Confirmation Modal */}
      {confirmLeaveGroupId && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-lg font-semibold mb-4">Are you sure you want to leave this group?</h2>
            <div className="flex gap-4 justify-end">
              <Button onClick={() => setConfirmLeaveGroupId(null)} variant="outline">Cancel</Button>
              <Button onClick={handleLeaveGroup} className="bg-[#924747] text-white hover:bg-[#924747]/90">Leave</Button>
            </div>
          </div>
        </div>
      )}

    </main>
    </ProtectedRoute>
  );
}
