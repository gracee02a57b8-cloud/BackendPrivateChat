/**
 * BarsikChat — Page Object: Call Window
 *
 * Covers: audio/video call UI, call controls, conference screen,
 * mini widget, incoming call modal
 *
 * Note: WebRTC calls cannot be fully tested in E2E — this POM
 * covers CSS structure verification and UI element presence.
 */
import { type Page, type Locator, expect } from '@playwright/test';

export class CallWindowPage {
  readonly page: Page;

  /* ── Call Screen ── */
  readonly callScreen: Locator;
  readonly callAudioCenter: Locator;
  readonly callPeerAvatar: Locator;
  readonly callPeerName: Locator;
  readonly callStatusLabel: Locator;
  readonly callVideoMain: Locator;
  readonly callVideoPip: Locator;

  /* ── Call Controls ── */
  readonly callControls: Locator;
  readonly minimizeBtn: Locator;
  readonly muteBtn: Locator;
  readonly videoToggleBtn: Locator;
  readonly confUpgradeBtn: Locator;
  readonly hangupBtn: Locator;

  /* ── Mini Widget ── */
  readonly miniWidget: Locator;
  readonly miniMuteBtn: Locator;
  readonly miniExpandBtn: Locator;
  readonly miniHangupBtn: Locator;

  /* ── Incoming Call ── */
  readonly incomingCallOverlay: Locator;
  readonly incomingAcceptBtn: Locator;
  readonly incomingDeclineBtn: Locator;

  /* ── Conference ── */
  readonly confScreen: Locator;
  readonly confHeader: Locator;
  readonly confGrid: Locator;
  readonly confTiles: Locator;
  readonly confControls: Locator;
  readonly confHangupBtn: Locator;
  readonly confShareBtn: Locator;
  readonly confMiniWidget: Locator;

  /* ── Security ── */
  readonly securityCode: Locator;

  constructor(page: Page) {
    this.page = page;

    // Call Screen
    this.callScreen = page.locator('.call-screen');
    this.callAudioCenter = page.locator('.call-audio-center');
    this.callPeerAvatar = page.locator('.call-peer-avatar');
    this.callPeerName = page.locator('.call-peer-name');
    this.callStatusLabel = page.locator('.call-status-label');
    this.callVideoMain = page.locator('.call-video-main');
    this.callVideoPip = page.locator('.call-video-pip');

    // Call Controls
    this.callControls = page.locator('.call-controls');
    this.minimizeBtn = page.locator('.call-control-btn[title="Свернуть звонок"]');
    this.muteBtn = page.locator('.call-control-btn[title*="микрофон"]');
    this.videoToggleBtn = page.locator('.call-control-btn[title*="камер"]');
    this.confUpgradeBtn = page.locator('.call-conf-btn');
    this.hangupBtn = page.locator('.call-hangup-btn');

    // Mini Widget
    this.miniWidget = page.locator('.call-mini-widget');
    this.miniMuteBtn = page.locator('.call-mini-mute');
    this.miniExpandBtn = page.locator('.call-mini-expand');
    this.miniHangupBtn = page.locator('.call-mini-hangup');

    // Incoming Call
    this.incomingCallOverlay = page.locator('.incoming-call-overlay');
    this.incomingAcceptBtn = page.locator('.incoming-call-accept');
    this.incomingDeclineBtn = page.locator('.incoming-call-decline');

    // Conference
    this.confScreen = page.locator('.conf-screen');
    this.confHeader = page.locator('.conf-header');
    this.confGrid = page.locator('.conf-grid');
    this.confTiles = page.locator('.conf-tile');
    this.confControls = page.locator('.conf-controls');
    this.confHangupBtn = page.locator('.conf-hangup-btn');
    this.confShareBtn = page.locator('.conf-share-btn');
    this.confMiniWidget = page.locator('.conf-mini-widget');

    // Security
    this.securityCode = page.locator('.call-security-code');
  }

  /** Verify call CSS classes are loaded in the stylesheet */
  async verifyCallCSSLoaded(): Promise<boolean> {
    return this.page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      const required = ['.call-screen', '.call-controls', '.call-control-btn', '.call-hangup-btn'];
      let found = 0;
      for (const sheet of sheets) {
        try {
          for (const rule of Array.from(sheet.cssRules || [])) {
            if (rule instanceof CSSStyleRule) {
              for (const r of required) {
                if (rule.selectorText?.includes(r)) found++;
              }
            }
          }
        } catch (e) {}
      }
      return found >= required.length;
    });
  }

  /** Verify conference CSS classes are loaded */
  async verifyConferenceCSSLoaded(): Promise<boolean> {
    return this.page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      const required = ['.conf-screen', '.conf-grid', '.conf-tile', '.conf-controls'];
      let found = 0;
      for (const sheet of sheets) {
        try {
          for (const rule of Array.from(sheet.cssRules || [])) {
            if (rule instanceof CSSStyleRule) {
              for (const r of required) {
                if (rule.selectorText?.includes(r)) found++;
              }
            }
          }
        } catch (e) {}
      }
      return found >= required.length;
    });
  }

  /** Get call control interactive elements for size testing */
  getCallControlElements(): Locator[] {
    return [
      this.minimizeBtn,
      this.muteBtn,
      this.videoToggleBtn,
      this.hangupBtn,
    ];
  }

  /** Dynamic elements to mask in screenshots */
  getDynamicMasks(): Locator[] {
    return [
      this.callStatusLabel,
      this.callPeerAvatar,
      this.callPeerName,
      this.page.locator('video'),
    ];
  }
}
