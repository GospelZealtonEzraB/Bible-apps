/** Curated study/memorization plan templates a circle can start together. */
export interface PlanTemplate {
  id: string;
  title: string;
  description: string;
  items: string[];
}

export const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: 'john-key',
    title: 'Gospel of John — Key Verses',
    description: '10 anchor verses through John',
    items: [
      'John 1:1', 'John 1:14', 'John 3:16', 'John 8:12', 'John 10:10',
      'John 11:25', 'John 13:34', 'John 14:6', 'John 15:5', 'John 20:31',
    ],
  },
  {
    id: 'romans-road',
    title: 'The Romans Road',
    description: 'The gospel through Romans',
    items: ['Romans 3:23', 'Romans 6:23', 'Romans 5:8', 'Romans 10:9', 'Romans 10:13'],
  },
  {
    id: 'psalms-comfort',
    title: 'Psalms of Comfort',
    description: 'Five psalms for hard days',
    items: ['Psalm 23:1-4', 'Psalm 46:1', 'Psalm 121:1-2', 'Psalm 27:1', 'Psalm 34:18'],
  },
  {
    id: 'foundations',
    title: 'Foundations of Faith',
    description: 'Core verses every believer should know',
    items: ['John 3:16', 'Ephesians 2:8-9', 'Romans 12:2', 'Philippians 4:13', '2 Timothy 3:16'],
  },
];
