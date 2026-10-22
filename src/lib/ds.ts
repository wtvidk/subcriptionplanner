/**
 * Advanced Data Structures used by Subscription Planner's server logic.
 * Each structure is used in real app logic (see planner.server.ts).
 */

/** Hash table: O(1) average insert/lookup. Indexes subscriptions & services by id. */
export class HashTable<V> {
  private buckets: Array<Array<[string, V]>>;
  private count = 0;
  constructor(private capacity = 64) { this.buckets = Array.from({ length: capacity }, () => []); }
  private hash(key: string) { let h = 5381; for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) | 0; return Math.abs(h) % this.capacity; }
  set(key: string, value: V) {
    const b = this.buckets[this.hash(key)];
    const e = b.find((x) => x[0] === key);
    if (e) e[1] = value; else { b.push([key, value]); this.count++; if (this.count > this.capacity * 0.75) this.resize(); }
  }
  get(key: string): V | undefined { return this.buckets[this.hash(key)].find((x) => x[0] === key)?.[1]; }
  has(key: string) { return this.get(key) !== undefined; }
  get size() { return this.count; }
  private resize() {
    const old = this.buckets.flat(); this.capacity *= 2; this.count = 0;
    this.buckets = Array.from({ length: this.capacity }, () => []);
    for (const [k, v] of old) this.set(k, v);
  }
}

/** Binary min-heap (priority queue): push/pop O(log n), peek O(1). Orders renewals by date. */
export class MinHeap<T> {
  private a: T[] = [];
  constructor(private cmp: (x: T, y: T) => number) {}
  get size() { return this.a.length; }
  peek() { return this.a[0]; }
  push(v: T) { const a = this.a; a.push(v); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (this.cmp(a[i], a[p]) >= 0) break; [a[i], a[p]] = [a[p], a[i]]; i = p; } }
  pop(): T | undefined {
    const a = this.a; if (!a.length) return undefined;
    const top = a[0]; const last = a.pop()!;
    if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i;
      if (l < a.length && this.cmp(a[l], a[m]) < 0) m = l; if (r < a.length && this.cmp(a[r], a[m]) < 0) m = r;
      if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; i = m; } }
    return top;
  }
}

/** FIFO queue (linked nodes): enqueue/dequeue O(1). Holds reminder events awaiting processing. */
export class Queue<T> {
  private head: { v: T; n?: any } | undefined; private tail: { v: T; n?: any } | undefined; private len = 0;
  enqueue(v: T) { const node = { v }; if (this.tail) this.tail.n = node; else this.head = node; this.tail = node; this.len++; }
  dequeue(): T | undefined { if (!this.head) return undefined; const v = this.head.v; this.head = this.head.n; if (!this.head) this.tail = undefined; this.len--; return v; }
  get size() { return this.len; }
}

/** Doubly linked list: O(1) prepend/remove-node. Holds cancelled history (newest first). */
class LNode<T> { prev?: LNode<T>; next?: LNode<T>; constructor(public v: T) {} }
export class LinkedList<T> {
  head?: LNode<T>; tail?: LNode<T>; size = 0;
  append(v: T) { const n = new LNode(v); if (!this.tail) this.head = this.tail = n; else { n.prev = this.tail; this.tail.next = n; this.tail = n; } this.size++; return n; }
  prepend(v: T) { const n = new LNode(v); if (!this.head) this.head = this.tail = n; else { n.next = this.head; this.head.prev = n; this.head = n; } this.size++; return n; }
  toArray() { const out: T[] = []; for (let c = this.head; c; c = c.next) out.push(c.v); return out; }
}

/** Merge sort: stable, O(n log n) time, O(n) space. Sorts subscriptions. */
export function mergeSort<T>(arr: T[], cmp: (a: T, b: T) => number): T[] {
  if (arr.length <= 1) return arr.slice();
  const mid = arr.length >> 1;
  const l = mergeSort(arr.slice(0, mid), cmp), r = mergeSort(arr.slice(mid), cmp);
  const out: T[] = []; let i = 0, j = 0;
  while (i < l.length && j < r.length) out.push(cmp(l[i], r[j]) <= 0 ? l[i++] : r[j++]);
  return out.concat(l.slice(i), r.slice(j));
}

/** Trie of lowercase words: prefix lookup O(k). Used for case-insensitive catalogue search. */
class TrieNode { children = new Map<string, TrieNode>(); ids = new Set<string>(); }
export class Trie {
  root = new TrieNode();
  insert(word: string, id: string) { let n = this.root; for (const ch of word.toLowerCase()) { if (!n.children.has(ch)) n.children.set(ch, new TrieNode()); n = n.children.get(ch)!; n.ids.add(id); } }
  prefix(p: string): Set<string> { let n = this.root; for (const ch of p.toLowerCase()) { const c = n.children.get(ch); if (!c) return new Set(); n = c; } return n.ids; }
}
