'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageCircle, Loader2, Lightbulb, Trash2 } from 'lucide-react';
import { Dialog, DialogActions } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { supabase } from '@/lib/supabase/client';
import {
  deduplicateSources,
  generateFollowUpSuggestions,
  renderContentWithCitations,
  renderMarkdownContent,
  shouldRenderMarkdown,
  type ChatSource,
} from './chatHelpers';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: ChatSource[];
  responseTime?: number;
  suggestions?: string[];
};

export default function ChatInterface({ meetingId }: { meetingId?: string }) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hi! I\'m your Meeting Intelligence Assistant. I can answer across all uploaded meetings and provide source snippets.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [folders, setFolders] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [attendees, setAttendees] = useState<string[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {};
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
    return headers;
  };

  // Initialize conversation on mount
  useEffect(() => {
    const initializeConversation = async () => {
      try {
        // Check if we have a previous conversation ID in localStorage
        const savedConvId = localStorage.getItem('lastConversationId');
        
        if (savedConvId) {
          // Try to load previous conversation
          try {
            const authHeaders = await getAuthHeaders();
            const response = await fetch(`/api/conversations/${savedConvId}`, {
              headers: authHeaders,
            });
            if (response.ok) {
              const data = await response.json();
              setConversationId(savedConvId);
              if (data.messages && data.messages.length > 0) {
                // Map database format to Message format
                const loadedMessages = data.messages.map((msg: any) => ({
                  id: msg.id,
                  role: msg.role,
                  content: msg.content,
                  timestamp: new Date(msg.created_at),
                  sources: msg.sources || [],
                }));
                setMessages(loadedMessages);
              }
              return; // Successfully loaded previous conversation
            }
          } catch (error) {
            console.log('Could not load previous conversation, creating new one');
          }
        }

        // Create a new conversation
        const authHeaders = await getAuthHeaders();
        const response = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ title: 'Chat Session' }),
        });
        const data = await response.json();
        if (data.conversation?.id) {
          const newConvId = data.conversation.id;
          setConversationId(newConvId);
          localStorage.setItem('lastConversationId', newConvId);
        }
      } catch (error) {
        console.error('Failed to initialize conversation:', error);
      }
    };

    // Fetch available folders
    const fetchFolders = async () => {
      try {
        const authHeaders = await getAuthHeaders();
        const response = await fetch('/api/folders', {
          headers: authHeaders,
        });
        if (response.ok) {
          const data = await response.json();
          setFolders(data.folders || []);
        } else {
          console.error('Failed to fetch folders:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('Failed to fetch folders:', error);
      }
    };

    initializeConversation();
    fetchFolders();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch attendees when folder changes
  useEffect(() => {
    const fetchAttendees = async () => {
      try {
        const url = selectedFolder 
          ? `/api/attendees?folder=${encodeURIComponent(selectedFolder)}`
          : '/api/attendees';
        const authHeaders = await getAuthHeaders();
        
        const response = await fetch(url, {
          headers: authHeaders,
        });
        if (response.ok) {
          const data = await response.json();
          setAttendees(data.attendees || []);
        } else {
          console.error('Failed to fetch attendees:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('Failed to fetch attendees:', error);
      }
    };

    fetchAttendees();
  }, [selectedFolder]);

  // Restore selected folder from localStorage on mount
  useEffect(() => {
    const savedFolder = localStorage.getItem('selectedFolder');
    if (savedFolder) {
      setSelectedFolder(savedFolder);
    }
  }, []);

  // Save selected folder to localStorage whenever it changes
  useEffect(() => {
    if (selectedFolder) {
      localStorage.setItem('selectedFolder', selectedFolder);
    }
  }, [selectedFolder]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleDeleteChat = () => {
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!conversationId) {
      // If no conversation ID, just reset messages
      setMessages([
        {
          id: '1',
          role: 'assistant',
          content: 'Hi! I\'m your Meeting Intelligence Assistant. I can answer across all uploaded meetings and provide source snippets.',
          timestamp: new Date(),
        },
      ]);
      setDeleteConfirmOpen(false);
      return;
    }

    setIsDeleting(true);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete conversation');
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error('Deletion failed - unknown error');
      }

      console.log(`✓ Chat deleted from database: ${conversationId}`);

      // Clear the conversation and start fresh
      localStorage.removeItem('lastConversationId');
      setConversationId(null);
      setMessages([
        {
          id: '1',
          role: 'assistant',
          content: 'Hi! I\'m your Meeting Intelligence Assistant. I can answer across all uploaded meetings and provide source snippets.',
          timestamp: new Date(),
        },
      ]);

      // Create a new conversation
      const newConvResponse = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ title: 'Chat Session' }),
      });
      const newConvData = await newConvResponse.json();
      if (newConvData.conversation?.id) {
        const newConvId = newConvData.conversation.id;
        setConversationId(newConvId);
        localStorage.setItem('lastConversationId', newConvId);
        console.log(`✓ New chat created: ${newConvId}`);
      }

      setDeleteSuccess(true);
      setDeleteConfirmOpen(false);
      
      // Auto-dismiss the success notification after 3 seconds
      setTimeout(() => setDeleteSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      alert(`Failed to delete chat: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    const startTime = Date.now(); // Improvement #5: Track response time

    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          message: input,
          meetingId: meetingId || null,
          projectGroup: selectedFolder || null,
          conversationHistory: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      console.log('[Chat UI] Sent query with projectGroup:', selectedFolder || null);

      const data = await response.json();
      const responseTime = Date.now() - startTime; // Improvement #5: Calculate response time

      if (!response.ok) throw new Error(data.error || 'Failed to get response');

      const dedupedSources = deduplicateSources(data.sources || []);
      const suggestions = generateFollowUpSuggestions(data.response, dedupedSources); // Improvement #3

      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        sources: dedupedSources,
        responseTime, // Improvement #5
        suggestions, // Improvement #3
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Save messages to database if conversation exists
      if (conversationId) {
        try {
          // Save user message
          await fetch(`/api/conversations/${conversationId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify({
              role: 'user',
              content: input,
              sources: null,
            }),
          });

          // Save assistant message
          await fetch(`/api/conversations/${conversationId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify({
              role: 'assistant',
              content: data.response,
              sources: dedupedSources,
            }),
          });
        } catch (error) {
          console.error('Failed to save messages to database:', error);
        }
      }
    } catch (error) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-linear-to-r from-indigo-600 to-indigo-700 px-6 py-4 flex items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <MessageCircle className="w-5 h-5 text-white" />
          <h3 className="text-lg font-semibold text-white">Meeting Assistant</h3>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Folder Selector */}
          <select
            value={selectedFolder}
            onChange={(e) => setSelectedFolder(e.target.value)}
            title="Select folder to filter meetings"
            className="px-3 py-2 bg-white/95 text-slate-800 border border-indigo-200 rounded-lg text-sm font-medium transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="">All Folders</option>
            {folders.map((folder) => (
              <option key={folder} value={folder}>
                {folder}
              </option>
            ))}
          </select>

          {/* Delete Chat Button */}
          <button
            onClick={handleDeleteChat}
            title="Delete this chat"
            className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition flex items-center gap-2 text-sm font-medium"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        </div>
      </div>

      {/* Attendees Info Bar - Hidden, user wants bot to answer instead */}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-lg px-4 py-3 rounded-2xl ${
                message.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-none'
                  : 'bg-gray-100 text-gray-900 rounded-bl-none'
              }`}
            >
              {/* Check if content has markdown formatting */}
              {message.role === 'assistant' && shouldRenderMarkdown(message.content) ? (
                <div className="text-sm leading-relaxed space-y-2">
                  {renderMarkdownContent(message.content, message.sources)}
                </div>
              ) : (
                <div className="text-sm leading-relaxed prose prose-sm max-w-none">
                  {renderContentWithCitations(message.content, message.sources)}
                </div>
              )}
              
              {/* Response time indicator - Improvement #5 */}
              {message.responseTime && (
                <div className="text-xs mt-2 opacity-60">{message.responseTime}ms</div>
              )}

              {/* De-duplicated sources - Improvement #2 */}
              {message.role === 'assistant' && message.sources && deduplicateSources(message.sources).length > 0 && (
                <div className="mt-3 border-t border-gray-300/50 pt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">Sources</p>
                  <ul className="mt-1 space-y-1 text-[11px] opacity-80">
                    {deduplicateSources(message.sources).map((source, idx) => (
                      <li key={`${message.id}-${source.meetingId}-${idx}`}>
                        <span className="text-indigo-600 font-semibold">[{idx + 1}]</span> {source.meetingName}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Follow-up suggestions - Improvement #3 */}
              {message.role === 'assistant' && message.suggestions && message.suggestions.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-300/50 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80 flex items-center gap-1">
                    <Lightbulb size={12} />
                    Suggestions
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {message.suggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setInput(suggestion);
                        }}
                        className="px-2 py-1 text-[10px] bg-indigo-100 text-indigo-700 rounded-full hover:bg-indigo-200 transition whitespace-nowrap truncate max-w-xs"
                        title={suggestion}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <span className="text-xs mt-2 block opacity-70">
                {message.timestamp.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-900 px-4 py-3 rounded-2xl rounded-bl-none flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-4 bg-gray-50">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Ask across all meetings (e.g., 'What are the top risks this week?')"
            className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            disabled={loading}
          />
          <button
            onClick={handleSendMessage}
            disabled={loading || !input.trim()}
            className="px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition disabled:bg-gray-300 flex items-center gap-2 font-medium"
            aria-label="Send message"
            title="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Chat"
        description="Are you sure you want to delete this chat? All messages and history will be permanently removed from the database. This action cannot be undone."
      >
        <DialogActions className="mt-6">
          <button
            onClick={() => setDeleteConfirmOpen(false)}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmDelete}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition disabled:bg-red-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Delete Chat
              </>
            )}
          </button>
        </DialogActions>
      </Dialog>

      {/* Success Notification */}
      {deleteSuccess && (
        <div className="fixed bottom-4 right-4 bg-green-50 border border-green-200 rounded-lg px-4 py-3 shadow-lg animate-in">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-600 rounded-full" />
            <div className="text-sm font-medium text-green-800">Chat deleted and removed from database</div>
          </div>
        </div>
      )}
    </div>
  );
}
