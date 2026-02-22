-- V7: Add voice message support fields
ALTER TABLE messages ADD COLUMN duration INTEGER;
ALTER TABLE messages ADD COLUMN waveform TEXT;
