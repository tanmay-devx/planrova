/**
 * src/modules/academic/flashcard.ui.js
 * Interactive Leitner Flashcard Review Player for Planrova 2.0.
 */

import {
  processFlashcardReview,
  computeDeckStats,
  FLASHCARD_RATINGS,
  LEITNER_BOX_INTERVALS
} from '../../../shared/domain/academic/index.js';
import { saveFlashcard, logFlashcardReview } from './academic-storage.js';

export function openFlashcardReviewPlayer({
  flashcards = [],
  deckTitle = 'Flashcard Review',
  onFinish = null
} = {}) {
  if (!flashcards || flashcards.length === 0) {
    alert('No flashcards due for review right now! Great job staying ahead.');
    return;
  }

  let modal = document.getElementById('flashcard-player-modal-overlay');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'flashcard-player-modal-overlay';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'z-index: 2600; background: rgba(0,0,0,0.88); backdrop-filter: blur(16px); display: flex; align-items: center; justify-content: center; position: fixed; inset: 0;';
    document.body.appendChild(modal);
  }

  let queue = [...flashcards];
  let currentIndex = 0;
  let isFlipped = false;
  let sessionResults = {
    totalReviewed: 0,
    againCount: 0,
    hardCount: 0,
    goodCount: 0,
    easyCount: 0
  };

  function cleanup() {
    window.removeEventListener('keydown', handleKeyDown);
    modal.remove();
    if (onFinish) onFinish();
  }

  function handleKeyDown(e) {
    if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

    if (e.code === 'Space') {
      e.preventDefault();
      isFlipped = !isFlipped;
      renderCard();
    } else if (isFlipped) {
      if (e.key === '1') handleRating(FLASHCARD_RATINGS.AGAIN);
      if (e.key === '2') handleRating(FLASHCARD_RATINGS.HARD);
      if (e.key === '3') handleRating(FLASHCARD_RATINGS.GOOD);
      if (e.key === '4') handleRating(FLASHCARD_RATINGS.EASY);
    }
  }

  window.addEventListener('keydown', handleKeyDown);

  function handleRating(rating) {
    const currentCard = queue[currentIndex];
    const { updatedCard, reviewRecord } = processFlashcardReview({
      flashcard: currentCard,
      rating,
      reviewTimestamp: Date.now()
    });

    saveFlashcard(updatedCard);
    logFlashcardReview(reviewRecord);

    sessionResults.totalReviewed++;
    if (rating === FLASHCARD_RATINGS.AGAIN) sessionResults.againCount++;
    if (rating === FLASHCARD_RATINGS.HARD) sessionResults.hardCount++;
    if (rating === FLASHCARD_RATINGS.GOOD) sessionResults.goodCount++;
    if (rating === FLASHCARD_RATINGS.EASY) sessionResults.easyCount++;

    currentIndex++;
    isFlipped = false;

    if (currentIndex >= queue.length) {
      renderCompletion();
    } else {
      renderCard();
    }
  }

  function renderCard() {
    const card = queue[currentIndex];
    const box = card.box || 1;
    const boxColors = {
      1: '#ef4444',
      2: '#f97316',
      3: '#eab308',
      4: '#3b82f6',
      5: '#10b981'
    };
    const boxColor = boxColors[box] || '#C2A878';

    modal.innerHTML = `
      <div style="background: #181512; border: 1px solid rgba(194,168,120,0.25); border-radius: 24px; width: 92%; max-width: 600px; padding: 28px; color: #fff; box-shadow: 0 25px 60px rgba(0,0,0,0.6); position:relative;">
        <!-- Header -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px;">
          <div>
            <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #C2A878; font-weight: 700;">${deckTitle}</span>
            <div style="font-size: 13px; color: #a8a29e; margin-top: 2px;">Card ${currentIndex + 1} of ${queue.length}</div>
          </div>
          <div style="display:flex; align-items:center; gap: 12px;">
            <span style="font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; background: ${boxColor}22; color: ${boxColor}; border: 1px solid ${boxColor}44;">
              Box ${box} (${LEITNER_BOX_INTERVALS[box]}d)
            </span>
            <button id="close-player-btn" style="background:none; border:none; color:#a8a29e; font-size: 24px; cursor:pointer;">×</button>
          </div>
        </div>

        <!-- 3D Flip Card Container -->
        <div id="flashcard-surface" style="min-height: 260px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 32px 24px; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; cursor:pointer; margin-bottom: 24px; transition: transform 0.2s ease;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #a8a29e; font-weight: 700; margin-bottom: 12px;">
            ${isFlipped ? 'Answer' : 'Question (Click or press Space to reveal)'}
          </div>
          <div style="font-size: 18px; font-weight: 600; line-height: 1.6; color: ${isFlipped ? '#34d399' : '#fff'}; white-space: pre-wrap;">
            ${isFlipped ? (card.back || 'No answer provided') : (card.front || 'Empty prompt')}
          </div>
        </div>

        <!-- Controls -->
        ${!isFlipped ? `
          <button id="flip-card-btn" style="width: 100%; padding: 14px; border-radius: 12px; background: #C2A878; color: #000; font-weight: 700; font-size: 14px; border:none; cursor:pointer;">
            Show Answer (Space)
          </button>
        ` : `
          <div>
            <div style="font-size: 11px; text-transform:uppercase; color: #a8a29e; font-weight: 700; margin-bottom: 8px; text-align:center;">Rate Recall</div>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
              <button id="btn-again" style="padding: 12px 8px; border-radius: 10px; background: rgba(239, 68, 68, 0.12); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.25); font-weight: 700; font-size: 12px; cursor:pointer;">
                Again [1]<br><span style="font-weight: 400; font-size: 10px;">Box 1 (1d)</span>
              </button>
              <button id="btn-hard" style="padding: 12px 8px; border-radius: 10px; background: rgba(249, 115, 22, 0.12); color: #f97316; border: 1px solid rgba(249, 115, 22, 0.25); font-weight: 700; font-size: 12px; cursor:pointer;">
                Hard [2]<br><span style="font-weight: 400; font-size: 10px;">Same Box</span>
              </button>
              <button id="btn-good" style="padding: 12px 8px; border-radius: 10px; background: rgba(59, 130, 246, 0.12); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.25); font-weight: 700; font-size: 12px; cursor:pointer;">
                Good [3]<br><span style="font-weight: 400; font-size: 10px;">+1 Box</span>
              </button>
              <button id="btn-easy" style="padding: 12px 8px; border-radius: 10px; background: rgba(16, 185, 129, 0.12); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.25); font-weight: 700; font-size: 12px; cursor:pointer;">
                Easy [4]<br><span style="font-weight: 400; font-size: 10px;">+2 Boxes</span>
              </button>
            </div>
          </div>
        `}
      </div>
    `;

    // Bind event listeners
    modal.querySelector('#close-player-btn')?.addEventListener('click', cleanup);
    modal.querySelector('#flashcard-surface')?.addEventListener('click', () => {
      isFlipped = !isFlipped;
      renderCard();
    });
    modal.querySelector('#flip-card-btn')?.addEventListener('click', () => {
      isFlipped = true;
      renderCard();
    });

    if (isFlipped) {
      modal.querySelector('#btn-again')?.addEventListener('click', () => handleRating(FLASHCARD_RATINGS.AGAIN));
      modal.querySelector('#btn-hard')?.addEventListener('click', () => handleRating(FLASHCARD_RATINGS.HARD));
      modal.querySelector('#btn-good')?.addEventListener('click', () => handleRating(FLASHCARD_RATINGS.GOOD));
      modal.querySelector('#btn-easy')?.addEventListener('click', () => handleRating(FLASHCARD_RATINGS.EASY));
    }
  }

  function renderCompletion() {
    window.removeEventListener('keydown', handleKeyDown);
    const retention = sessionResults.totalReviewed > 0
      ? Math.round(((sessionResults.goodCount + sessionResults.easyCount) / sessionResults.totalReviewed) * 100)
      : 100;

    modal.innerHTML = `
      <div style="background: #181512; border: 1px solid rgba(194,168,120,0.25); border-radius: 24px; width: 92%; max-width: 500px; padding: 36px 28px; color: #fff; text-align: center; box-shadow: 0 25px 60px rgba(0,0,0,0.6);">
        <div style="font-size: 40px; margin-bottom: 12px;">🎉</div>
        <h2 style="font-size: 22px; font-weight: 700; color: #C2A878; margin: 0 0 6px 0;">Session Completed!</h2>
        <p style="font-size: 13px; color: #a8a29e; margin: 0 0 24px 0;">You reviewed ${sessionResults.totalReviewed} cards today.</p>

        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 18px; margin-bottom: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <div style="font-size: 11px; text-transform: uppercase; color: #a8a29e; font-weight: 700;">Recall Rate</div>
            <div style="font-size: 26px; font-weight: 800; color: #10b981; margin-top: 4px;">${retention}%</div>
          </div>
          <div>
            <div style="font-size: 11px; text-transform: uppercase; color: #a8a29e; font-weight: 700;">Learned / Promoted</div>
            <div style="font-size: 26px; font-weight: 800; color: #C2A878; margin-top: 4px;">${sessionResults.goodCount + sessionResults.easyCount}</div>
          </div>
        </div>

        <button id="close-session-btn" style="width: 100%; padding: 14px; border-radius: 12px; background: #C2A878; color: #000; font-weight: 700; font-size: 14px; border:none; cursor:pointer;">
          Return to Workspace
        </button>
      </div>
    `;

    modal.querySelector('#close-session-btn')?.addEventListener('click', cleanup);
  }

  renderCard();
}

