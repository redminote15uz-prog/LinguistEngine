import { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Loader2, BookOpen, Bookmark, BookmarkCheck, Star, Sparkles } from 'lucide-react';
import { StoryResponse } from '../types';

interface StoryViewerProps {
  story: StoryResponse;
  activeLanguage: 'en' | 'ru' | 'uz' | 'parallel';
  onLanguageChange: (lang: 'en' | 'ru' | 'uz' | 'parallel') => void;
  onWordClick: (word: string) => void;
  highlightedWord: string | null;
  isSaved?: boolean;
  onToggleSave?: () => void;
}

const VOICES = [
  { id: 'Kore', name: 'Kore (Female - Cheerful)' },
  { id: 'Zephyr', name: 'Zephyr (Male - Calm)' },
  { id: 'Puck', name: 'Puck (Male - Lively)' },
  { id: 'Charon', name: 'Charon (Male - Steady)' },
  { id: 'Fenrir', name: 'Fenrir (Male - Deep)' }
];

export default function StoryViewer({
  story,
  activeLanguage,
  onLanguageChange,
  onWordClick,
  highlightedWord,
  isSaved = false,
  onToggleSave
}: StoryViewerProps) {
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [engineMode, setEngineMode] = useState<'browser' | 'gemini'>('browser');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [playbackTextSource, setPlaybackTextSource] = useState<'en' | 'ru' | 'uz'>('en');
  
  // Local browser voices state
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedBrowserVoiceURI, setSelectedBrowserVoiceURI] = useState<string>('');
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Load browser voices
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const updateVoices = () => {
        const allVoices = window.speechSynthesis.getVoices();
        setBrowserVoices(allVoices);
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  // Sync selected voice when language tab changes
  useEffect(() => {
    if (browserVoices.length > 0) {
      const targetLang = activeLanguage === 'parallel' ? 'en' : activeLanguage;
      const matching = browserVoices.filter(v => v.lang.toLowerCase().startsWith(targetLang));
      if (matching.length > 0) {
        // Find a "Natural" voice first if possible, otherwise first matching
        const naturalVoice = matching.find(v => v.name.toLowerCase().includes('natural') || v.name.toLowerCase().includes('google'));
        setSelectedBrowserVoiceURI(naturalVoice ? naturalVoice.voiceURI : matching[0].voiceURI);
      }
    }
  }, [activeLanguage, browserVoices]);

  // Stop any ongoing audio playback when unmounted or when story changes
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, [story]);

  const stopAudio = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) {
        // Already stopped
      }
      audioSourceRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    setIsPlaying(false);
    setIsLoadingAudio(false);
  };

  const playTTS = async (text: string, lang: 'en' | 'ru' | 'uz') => {
    if (isPlaying) {
      stopAudio();
      return;
    }

    const cleanText = text.replace(/<\/hl>|<hl>/g, "");

    if (engineMode === 'browser') {
      if (!('speechSynthesis' in window)) {
        alert('Your browser does not support Speech Synthesis. Please switch to Gemini Premium voice.');
        return;
      }

      setIsLoadingAudio(true);
      setPlaybackTextSource(lang);

      // Simple browser synthesis delay buffer logic
      setTimeout(() => {
        try {
          // Cancel any existing synthesis
          window.speechSynthesis.cancel();

          const utterance = new SpeechSynthesisUtterance(cleanText);
          
          if (lang === 'en') {
            utterance.lang = 'en-US';
          } else if (lang === 'ru') {
            utterance.lang = 'ru-RU';
          } else if (lang === 'uz') {
            utterance.lang = 'uz-UZ';
          }

          // Pick selected browser voice if available
          const voices = window.speechSynthesis.getVoices();
          let voice = voices.find(v => v.voiceURI === selectedBrowserVoiceURI);
          
          if (!voice) {
            // Fallback matching language prefix
            voice = voices.find(v => v.lang.toLowerCase().startsWith(lang));
          }
          
          if (!voice && lang === 'uz') {
            // Fallback to Turkish or system voice if Uzbek is not preinstalled locally
            voice = voices.find(v => v.lang.toLowerCase().startsWith('tr')) || voices.find(v => v.lang.toLowerCase().startsWith('ru'));
          }

          if (voice) {
            utterance.voice = voice;
            utterance.lang = voice.lang;
          }

          utterance.onstart = () => {
            setIsLoadingAudio(false);
            setIsPlaying(true);
          };

          utterance.onend = () => {
            setIsPlaying(false);
          };

          utterance.onerror = (e) => {
            console.error('Speech synthesis error', e);
            setIsPlaying(false);
            setIsLoadingAudio(false);
          };

          window.speechSynthesis.speak(utterance);
        } catch (err) {
          console.error(err);
          setIsPlaying(false);
          setIsLoadingAudio(false);
        }
      }, 50);
      return;
    }

    setIsLoadingAudio(true);
    setPlaybackTextSource(lang);

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: selectedVoice })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to generate speech');
      }

      const { audioData } = await response.json();
      
      // Decode raw 16-bit PCM little endian audio at 24000Hz
      const binaryString = window.atob(audioData);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const numSamples = len / 2;
      const int16Array = new Int16Array(bytes.buffer);
      
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtxClass({ sampleRate: 24000 });
      audioCtxRef.current = audioCtx;

      const buffer = audioCtx.createBuffer(1, numSamples, 24000);
      const channelData = buffer.getChannelData(0);
      
      for (let i = 0; i < numSamples; i++) {
        // Normalize int16 sample to float [-1.0, 1.0]
        channelData[i] = int16Array[i] / 32768.0;
      }
      
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      
      source.onended = () => {
        setIsPlaying(false);
      };

      audioSourceRef.current = source;
      setIsLoadingAudio(false);
      setIsPlaying(true);
      source.start(0);

    } catch (error: any) {
      console.error('Error playing speech:', error);
      alert(error.message || 'Error producing Speech. Make sure Gemini API Key is active.');
      setIsLoadingAudio(false);
      setIsPlaying(false);
    }
  };

  const renderHighlightedText = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(<\/hl>|<hl>)/g);
    let isHighlight = false;
    
    return parts.map((part, index) => {
      if (part === '<hl>') {
        isHighlight = true;
        return null;
      }
      if (part === '</hl>') {
        isHighlight = false;
        return null;
      }
      if (isHighlight) {
        // Clean word to match with mapped definitions
        const cleanWord = part.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "").trim().toLowerCase();
        const isMatched = highlightedWord?.toLowerCase() === cleanWord;

        return (
          <span
            key={index}
            onClick={() => onWordClick(cleanWord)}
            className={`cursor-pointer px-1 py-0.5 rounded font-semibold transition-all duration-200 inline-block ${
              isMatched
                ? 'bg-indigo-600 text-white shadow-xs scale-105 ring-2 ring-indigo-400'
                : 'bg-amber-100 text-amber-950 hover:bg-amber-200 border-b border-amber-300'
            }`}
            title="Click to view definition"
          >
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    }).filter(Boolean);
  };

  const activeText = 
    activeLanguage === 'en' ? story.englishStory :
    activeLanguage === 'ru' ? story.russianTranslation :
    activeLanguage === 'uz' ? story.uzbekTranslation : story.englishStory;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full">
      {/* Viewer Header Toggles */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="font-semibold text-slate-800 dark:text-slate-200">
            Story Reader
          </h2>
          
          {onToggleSave && (
            <button
              onClick={onToggleSave}
              className={`ml-2 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md border transition-all cursor-pointer ${
                isSaved
                  ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900'
                  : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
              }`}
              title={isSaved ? "Saved to Library" : "Save Story to Library"}
            >
              {isSaved ? (
                <>
                  <BookmarkCheck className="w-3 h-3 text-rose-600 fill-rose-600 shrink-0" /> Saved
                </>
              ) : (
                <>
                  <Bookmark className="w-3 h-3 text-slate-400 shrink-0" /> Save Story
                </>
              )}
            </button>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap p-1 bg-slate-100 dark:bg-slate-800 rounded-xl max-w-max">
          <button
            onClick={() => onLanguageChange('en')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeLanguage === 'en'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            English
          </button>
          <button
            onClick={() => onLanguageChange('ru')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeLanguage === 'ru'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Russian
          </button>
          <button
            onClick={() => onLanguageChange('uz')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeLanguage === 'uz'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Uzbek
          </button>
          <button
            onClick={() => onLanguageChange('parallel')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeLanguage === 'parallel'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Parallel Columns
          </button>
        </div>
      </div>

      {/* Audio TTS Controls Strip */}
      {activeLanguage !== 'parallel' && (
        <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setEngineMode('browser');
                  stopAudio();
                }}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                  engineMode === 'browser'
                    ? 'bg-white text-indigo-700 shadow-xs dark:bg-slate-700 dark:text-indigo-300'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
                title="Instant, offline, zero quota usage"
              >
                ⚡ Fast Local Voice
              </button>
              <button
                type="button"
                onClick={() => {
                  setEngineMode('gemini');
                  stopAudio();
                }}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                  engineMode === 'gemini'
                    ? 'bg-white text-indigo-700 shadow-xs dark:bg-slate-700 dark:text-indigo-300'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
                title="High quality neural synthesis from Gemini"
              >
                ✨ Premium Neural Voice
              </button>
            </div>

            {engineMode === 'gemini' ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 font-medium">Voice:</span>
                <select
                  value={selectedVoice}
                  onChange={(e) => {
                    setSelectedVoice(e.target.value);
                    if (isPlaying) stopAudio();
                  }}
                  className="text-[10px] font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300 focus:outline-hidden cursor-pointer"
                >
                  {VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">Free Local Voice:</span>
                <select
                  value={selectedBrowserVoiceURI}
                  onChange={(e) => {
                    setSelectedBrowserVoiceURI(e.target.value);
                    if (isPlaying) stopAudio();
                  }}
                  className="text-[10px] max-w-[180px] font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300 focus:outline-hidden cursor-pointer"
                >
                  {browserVoices
                    .filter(v => {
                      const targetLang = activeLanguage;
                      return v.lang.toLowerCase().startsWith(targetLang) || (targetLang === 'uz' && v.lang.toLowerCase().startsWith('tr'));
                    })
                    .map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  {browserVoices.filter(v => {
                    const targetLang = activeLanguage;
                    return v.lang.toLowerCase().startsWith(targetLang) || (targetLang === 'uz' && v.lang.toLowerCase().startsWith('tr'));
                  }).length === 0 && (
                    <option value="">Default System Voice</option>
                  )}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isLoadingAudio ? (
              <button
                disabled
                className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 text-xs rounded-lg font-medium border border-indigo-200 dark:border-indigo-900"
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {engineMode === 'browser' ? 'Preparing Voice...' : 'Generating Neural Speech...'}
              </button>
            ) : isPlaying && playbackTextSource === activeLanguage ? (
              <div className="flex items-center gap-3">
                {/* Wavy voice animation */}
                <div className="flex items-center gap-0.5 h-3">
                  <span className="w-0.5 bg-emerald-500 rounded-full animate-[bounce_1s_infinite_100ms] h-full"></span>
                  <span className="w-0.5 bg-emerald-500 rounded-full animate-[bounce_1s_infinite_300ms] h-2"></span>
                  <span className="w-0.5 bg-emerald-500 rounded-full animate-[bounce_1s_infinite_200ms] h-3"></span>
                  <span className="w-0.5 bg-emerald-500 rounded-full animate-[bounce_1s_infinite_400ms] h-1.5"></span>
                </div>
                <button
                  onClick={stopAudio}
                  className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 dark:text-rose-400 text-xs rounded-lg font-medium border border-rose-200 dark:border-rose-900 cursor-pointer transition-colors"
                >
                  <VolumeX className="w-3.5 h-3.5" />
                  Stop Playback
                </button>
              </div>
            ) : (
              <button
                onClick={() => playTTS(activeText, activeLanguage as 'en' | 'ru' | 'uz')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-lg font-semibold cursor-pointer transition-colors shadow-xs"
              >
                <Volume2 className="w-3.5 h-3.5" />
                Read Aloud ({activeLanguage === 'en' ? 'English' : activeLanguage === 'ru' ? 'Russian' : 'Uzbek'})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="p-6 overflow-y-auto flex-1 dark:text-slate-300">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white mb-6 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
          <span>{story.title}</span>
          <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase border border-slate-200 dark:border-slate-800 rounded px-1.5 py-0.5">
            Story Text
          </span>
        </h1>

        {activeLanguage !== 'parallel' ? (
          <div className="prose prose-indigo max-w-none text-slate-700 dark:text-slate-300 leading-relaxed text-sm md:text-base space-y-4 font-sans whitespace-pre-line">
            {renderHighlightedText(activeText)}
          </div>
        ) : (
          /* Parallel View Grid */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* English Column */}
            <div className="space-y-3 bg-slate-50/50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1">
                  🇬🇧 English Story
                </span>
                <button
                  onClick={() => playTTS(story.englishStory, 'en')}
                  className="p-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
                  title="Speak English"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="prose prose-indigo text-slate-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                {renderHighlightedText(story.englishStory)}
              </div>
            </div>

            {/* Russian Column */}
            <div className="space-y-3 bg-slate-50/50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1">
                  🇷🇺 Русский Перевод
                </span>
                <button
                  onClick={() => playTTS(story.russianTranslation, 'ru')}
                  className="p-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
                  title="Speak Russian"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="prose prose-indigo text-slate-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                {renderHighlightedText(story.russianTranslation)}
              </div>
            </div>

            {/* Uzbek Column */}
            <div className="space-y-3 bg-slate-50/50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1">
                  🇺🇿 O&apos;zbek Tarjimasi
                </span>
                <button
                  onClick={() => playTTS(story.uzbekTranslation, 'uz')}
                  className="p-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
                  title="Speak Uzbek"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="prose prose-indigo text-slate-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                {renderHighlightedText(story.uzbekTranslation)}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-amber-50/40 dark:bg-amber-950/10 border-t border-slate-200 dark:border-slate-800 px-6 py-3 text-xs text-amber-800 dark:text-amber-400 flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 shrink-0 text-amber-600" />
        <span>Click on any highlighted word to explore its meaning, definition, and native translations instantly.</span>
      </div>
    </div>
  );
}
