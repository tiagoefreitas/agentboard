/**
 * TerminalTextOverlay - Transparent text layer for native iOS text selection
 * Renders actual DOM text positioned exactly over the xterm.js canvas
 * Activated by long-press, dismissed on copy or tap outside
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import type { Terminal } from 'xterm'

interface TerminalTextOverlayProps {
  terminal: Terminal
  fontSize: number
  onDismiss: () => void
}

export default function TerminalTextOverlay({
  terminal,
  fontSize,
  onDismiss,
}: TerminalTextOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const hasInteractedRef = useRef(false)
  const [letterSpacingAdjust, setLetterSpacingAdjust] = useState(0)
  const [verticalOffset, setVerticalOffset] = useState(0)

  // Extract visible text from terminal buffer
  const getVisibleLines = useCallback(() => {
    const buffer = terminal.buffer.active
    const lines: string[] = []

    for (let i = 0; i < terminal.rows; i++) {
      const lineIndex = buffer.viewportY + i
      const line = buffer.getLine(lineIndex)
      let text = line?.translateToString(false) ?? ''

      lines.push(text)
    }

    return lines
  }, [terminal])

  // Get terminal dimensions for positioning
  const getTerminalMetrics = useCallback(() => {
    const core = (terminal as any)._core
    const dimensions = core?._renderService?.dimensions
    const optionsService = core?._optionsService

    // Get exact cell dimensions from xterm's actual renderer
    const actualCellHeight = dimensions?.css?.cell?.height ?? fontSize * 1.4
    const actualCellWidth = dimensions?.css?.cell?.width ?? fontSize * 0.6

    // xterm applies padding to the canvas container
    const canvasPaddingLeft = dimensions?.css?.canvas?.left ?? 0
    const canvasPaddingTop = dimensions?.css?.canvas?.top ?? 0

    // Get the actual font xterm is using
    const fontFamily = optionsService?.rawOptions?.fontFamily ?? '"JetBrains Mono", "SF Mono", "Fira Code", monospace'
    const lineHeight = optionsService?.rawOptions?.lineHeight ?? 1.4

    return {
      cellHeight: actualCellHeight,
      cellWidth: actualCellWidth,
      canvasPaddingLeft,
      canvasPaddingTop,
      fontFamily,
      lineHeight
    }
  }, [terminal, fontSize])

  // Handle copy event - dismiss after successful copy
  useEffect(() => {
    const handleCopy = () => {
      // Small delay to let the copy complete
      setTimeout(() => {
        onDismiss()
      }, 100)
    }

    document.addEventListener('copy', handleCopy)
    return () => document.removeEventListener('copy', handleCopy)
  }, [onDismiss])

  // Handle tap outside to dismiss
  useEffect(() => {
    const handleTouchStart = (_e: TouchEvent) => {
      // Ignore first touch (the one that might start a selection)
      if (!hasInteractedRef.current) {
        hasInteractedRef.current = true
        return
      }

      // If touch is outside overlay or selection is empty, dismiss
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed) {
        // Check if we're not starting a new selection
        setTimeout(() => {
          const newSelection = window.getSelection()
          if (!newSelection || newSelection.isCollapsed) {
            onDismiss()
          }
        }, 100)
      }
    }

    // Add listener with a small delay to avoid triggering on the activating long-press
    const timer = setTimeout(() => {
      document.addEventListener('touchstart', handleTouchStart)
    }, 300)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('touchstart', handleTouchStart)
    }
  }, [onDismiss])

  const lines = getVisibleLines()
  const { cellHeight, cellWidth, fontFamily } = getTerminalMetrics()

  // Measure actual DOM character dimensions and calculate adjustments
  useEffect(() => {
    // Create measurement element matching xterm's approach
    const measureEl = document.createElement('span')
    measureEl.style.cssText = `
      position: absolute;
      visibility: hidden;
      font-family: ${fontFamily};
      font-size: ${fontSize}px;
      line-height: normal;
      white-space: pre;
      font-kerning: none;
      display: inline-block;
    `
    measureEl.textContent = 'W'.repeat(32)
    document.body.appendChild(measureEl)

    const domCharWidth = measureEl.offsetWidth / 32
    const domLineHeight = measureEl.offsetHeight

    document.body.removeChild(measureEl)

    // Calculate adjustments needed
    const widthAdjustment = cellWidth - domCharWidth
    setLetterSpacingAdjust(widthAdjustment)

    // Vertical offset: center the DOM text within xterm's cell height
    // DOM renders text at top of line-height, xterm centers it
    const vOffset = (cellHeight - domLineHeight) / 2
    setVerticalOffset(vOffset)

    console.log('Dimension comparison:', {
      xtermCellWidth: cellWidth,
      domCharWidth,
      widthAdjustment,
      xtermCellHeight: cellHeight,
      domLineHeight,
      verticalOffset: vOffset
    })
  }, [cellWidth, cellHeight, fontSize, fontFamily])

  // xterm has 8px padding in CSS (.xterm { padding: 8px })
  const xtermPadding = 8

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 z-20 terminal-text-overlay"
      tabIndex={-1}
      inputMode="none"
      style={{
        // Transparent background but selectable text
        background: 'transparent',
        // Enable native text selection
        userSelect: 'text',
        WebkitUserSelect: 'text',
        // Prevent touch scrolling while selecting
        touchAction: 'none',
        // Match terminal cursor
        cursor: 'text',
        // Account for xterm's padding
        padding: `${xtermPadding}px`,
        // Prevent keyboard from appearing - read-only selection
        WebkitUserModify: 'read-only',
      }}
      // Prevent focus to avoid keyboard
      onFocus={(e) => {
        e.preventDefault()
        if (e.target instanceof HTMLElement) {
          e.target.blur()
        }
      }}
    >
      {/* Render each line matching xterm's char-measure-element styles */}
      {lines.map((line, lineIdx) => (
        <div
          key={lineIdx}
          style={{
            position: 'absolute',
            top: `${xtermPadding + lineIdx * cellHeight + verticalOffset}px`,
            left: `${xtermPadding}px`,
            height: `${cellHeight}px`,
            // Match xterm's measurement element exactly
            display: 'inline-block',
            // Explicitly exclude emoji fonts from fallback chain
            fontFamily: `${fontFamily}, "Symbols Nerd Font", sans-serif`,
            fontSize: `${fontSize}px`,
            lineHeight: 'normal', // xterm uses line-height: normal
            whiteSpace: 'pre',
            fontKerning: 'none',
            // Adjust letter-spacing to match xterm's character width
            letterSpacing: `${letterSpacingAdjust}px`,
            // Force text rendering instead of emoji
            fontVariantEmoji: 'text',
            WebkitFontSmoothing: 'antialiased',
            // Debug: slightly visible red
            color: 'rgba(255, 0, 0, 0.2)',
          }}
        >
          {line || '\u00A0'}
        </div>
      ))}
    </div>
  )
}
