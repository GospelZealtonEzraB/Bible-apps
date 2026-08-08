/**
 * Bundled World English Bible (WEB, public domain) text for common verses.
 * Used as an offline fallback when the network is unavailable and to make the
 * starter packs work on first run. The live API remains the source of truth.
 * Keyed by normalized reference (see normalizeKey in bibleApi.ts).
 */
export const WEB_FIXTURES: Record<string, string> = {
  'john 3:16':
    'For God so loved the world, that he gave his one and only Son, that whoever believes in him should not perish, but have eternal life.',
  'john 1:1':
    'In the beginning was the Word, and the Word was with God, and the Word was God.',
  'john 14:27':
    "Peace I leave with you. My peace I give to you; not as the world gives, I give to you. Don't let your heart be troubled, neither let it be fearful.",
  'romans 3:23': 'for all have sinned, and fall short of the glory of God;',
  'romans 5:8':
    'But God commends his own love toward us, in that while we were yet sinners, Christ died for us.',
  'romans 6:23':
    'For the wages of sin is death, but the free gift of God is eternal life in Christ Jesus our Lord.',
  'romans 10:9':
    'that if you will confess with your mouth that Jesus is Lord, and believe in your heart that God raised him from the dead, you will be saved.',
  'romans 10:13':
    "For, “Whoever will call on the name of the Lord will be saved.”",
  'ephesians 2:8-9':
    'for by grace you have been saved through faith, and that not of yourselves; it is the gift of God, not of works, that no one would boast.',
  'philippians 4:6-7':
    'In nothing be anxious, but in everything, by prayer and petition with thanksgiving, let your requests be made known to God. And the peace of God, which surpasses all understanding, will guard your hearts and your thoughts in Christ Jesus.',
  'philippians 4:13':
    'I can do all things through Christ, who strengthens me.',
  'matthew 6:34':
    "Therefore don't be anxious for tomorrow, for tomorrow will be anxious for itself. Each day's own evil is sufficient.",
  'isaiah 41:10':
    "Don't you be afraid, for I am with you. Don't be dismayed, for I am your God. I will strengthen you. Yes, I will help you. Yes, I will uphold you with the right hand of my righteousness.",
  'isaiah 40:31':
    'but those who wait for Yahweh will renew their strength. They will mount up with wings like eagles. They will run, and not be weary. They will walk, and not faint.',
  '1 peter 5:7':
    'casting all your worries on him, because he cares for you.',
  'psalm 23:1': 'Yahweh is my shepherd; I shall lack nothing.',
  'psalm 27:1':
    'Yahweh is my light and my salvation. Whom shall I fear? Yahweh is the strength of my life. Of whom shall I be afraid?',
  'psalm 28:7':
    'Yahweh is my strength and my shield. My heart has trusted in him, and I am helped. Therefore my heart greatly rejoices. With my song I will thank him.',
  'psalm 34:4':
    'I sought Yahweh, and he answered me, and delivered me from all my fears.',
  'psalm 34:18':
    'Yahweh is near to those who have a broken heart, and saves those who have a crushed spirit.',
  'psalm 46:1':
    'God is our refuge and strength, a very present help in trouble.',
  'psalm 121:1-2':
    'I will lift up my eyes to the hills. Where does my help come from? My help comes from Yahweh, who made heaven and earth.',
  'psalm 119:11':
    'I have hidden your word in my heart, that I might not sin against you.',
  'joshua 1:9':
    "Haven't I commanded you? Be strong and courageous. Don't be afraid. Don't be dismayed, for Yahweh your God is with you wherever you go.",
  'hebrews 11:1':
    'Now faith is assurance of things hoped for, proof of things not seen.',
  '2 timothy 1:7':
    "For God didn't give us a spirit of fear, but of power, love, and self-control.",
  'proverbs 3:5-6':
    "Trust in Yahweh with all your heart, and don't lean on your own understanding. In all your ways acknowledge him, and he will make your paths straight.",
  'jeremiah 29:11':
    'For I know the thoughts that I think toward you,” says Yahweh, “thoughts of peace, and not of evil, to give you hope and a future.',
};
