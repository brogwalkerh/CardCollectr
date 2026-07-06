import { useState, useRef, useCallback } from 'react';
import { Camera, Search } from 'lucide-react';
import { searchCards, getCardPrice } from '../api/scryfall';
import { useCollection } from '../hooks/useCollection';
import { CardImage } from '../components/card/CardImage';
import { Spinner } from '../components/ui/Spinner';
import { useToast } from '../context/ToastContext';
import type { ScryfallCard } from '../types';
import { formatPrice } from '../utils/format';

export function ScannerPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);
  const [cardName, setCardName] = useState('');
  const [matchedCard, setMatchedCard] = useState<ScryfallCard | null>(null);
  const [searching, setSearching] = useState(false);
  const { addCard } = useCollection();
  const { addToast } = useToast();

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStreaming(true);
      }
    } catch {
      addToast('Could not access camera', 'error');
    }
  }, [addToast]);

  function stopCamera() {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(t => t.stop());
    setStreaming(false);
  }

  function captureFrame() {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')!.drawImage(videoRef.current, 0, 0);
    setCaptured(canvas.toDataURL('image/jpeg', 0.8));
    stopCamera();
  }

  async function searchByName() {
    if (!cardName.trim()) return;
    setSearching(true);
    try {
      const res = await searchCards(cardName);
      if (res.data.length > 0) {
        setMatchedCard(res.data[0]);
      } else {
        addToast('No match found', 'error');
      }
    } catch { addToast('Search failed', 'error'); }
    setSearching(false);
  }

  async function addToCollection() {
    if (!matchedCard) return;
    await addCard(matchedCard.id, 1, 'NM', false);
    addToast(`Added ${matchedCard.name}`, 'success');
    setMatchedCard(null);
    setCaptured(null);
    setCardName('');
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Card Scanner</h1>

      <div className="space-y-4">
        <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
          {!streaming && !captured && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Camera size={48} className="text-gray-500 mb-4" />
              <button onClick={startCamera} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                Start Camera
              </button>
              <p className="text-xs text-gray-400 mt-2">Point camera at a Magic card, then capture and identify</p>
            </div>
          )}
          <video ref={videoRef} autoPlay playsInline className={`w-full h-full object-cover ${streaming ? '' : 'hidden'}`} />
          {captured && <img src={captured} alt="Captured" className="w-full h-full object-cover" />}
        </div>

        {streaming && (
          <div className="flex gap-2 justify-center">
            <button onClick={captureFrame} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Capture</button>
            <button onClick={stopCamera} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300">Cancel</button>
          </div>
        )}

        {captured && !matchedCard && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">Type the card name you see to identify it:</p>
            <form onSubmit={e => { e.preventDefault(); searchByName(); }} className="flex gap-2">
              <input value={cardName} onChange={e => setCardName(e.target.value)} placeholder="Enter card name..." className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
              <button type="submit" disabled={searching} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                {searching ? <Spinner size="sm" /> : <Search size={18} />}
              </button>
            </form>
            <button onClick={() => { setCaptured(null); setCardName(''); }} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Retake photo</button>
          </div>
        )}

        {matchedCard && (
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="flex gap-4">
              <CardImage card={matchedCard} size="normal" className="w-32" />
              <div className="flex-1 space-y-2">
                <h3 className="font-semibold text-gray-900 dark:text-white">{matchedCard.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{matchedCard.set_name}</p>
                <p className="text-sm text-green-600 dark:text-green-400">{formatPrice(getCardPrice(matchedCard))}</p>
                <div className="flex gap-2 pt-2">
                  <button onClick={addToCollection} className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">Add to Collection</button>
                  <button onClick={() => { setMatchedCard(null); setCardName(''); setCaptured(null); }} className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300">Scan Another</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
