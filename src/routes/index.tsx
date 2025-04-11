import { component$, useVisibleTask$, useSignal, useStyles$, $, useStore } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { WalletConnect } from "~/components/wallet-connect";

// This is our application URL - change this to your own domain when deploying
const appUrl = "https://compu-borg-boost.vercel.app";

// Farcaster Frame meta configuration
const frame = {
  version: "next",
  imageUrl: `${appUrl}/image.png`,
  button: {
    title: "Borg Boost",
    action: {
      type: "launch_frame",
      name: "Borg Boost", 
      url: appUrl,
      splashImageUrl: `${appUrl}/icon.png`,
      splashBackgroundColor: "#000000",
    },
  },
};

// Original component with performance metrics
interface PerformanceMetrics {
  pageLoadTime?: number;
  fcp?: number; // First Contentful Paint
  lcp?: number; // Largest Contentful Paint
  ttfb?: number; // Time to First Byte
  cls?: number; // Cumulative Layout Shift
  fid?: number; // First Input Delay
}

// This component demonstrates lazy loading
export const LazyDemo = component$(() => {
  const store = useStore({ count: 0 });
  
  // Initialize from localStorage on mount
  useVisibleTask$(() => {
    // Load initial value from localStorage
    const savedCount = localStorage.getItem('demo-count');
    if (savedCount) {
      store.count = parseInt(savedCount, 10);
    }
  });
  
  return (
    <div class="lazy-demo">
      <h4>Lazy Loading</h4>
      <p>This component's event handler is lazy loaded.</p>
      <p>Count: {store.count}</p>
      <button onClick$={() => {
        store.count++;
        console.log('Counter updated:', store.count);
        localStorage.setItem('demo-count', store.count.toString());
      }}>
        +1
      </button>
      <p class="hint">Check the Network tab to see JS chunks loaded on demand</p>
      <p class="hint">The counter value persists across refreshes!</p>
    </div>
  );
});

export default component$(() => {
  const metrics = useSignal<PerformanceMetrics>({});
  const showMetrics = useSignal(false);
  const showDemo = useSignal(false);
  
  useStyles$(`
    .metrics-container, .demo-container {
      margin-top: 2rem;
      padding: 1rem;
      border: 1px solid #eaeaea;
      border-radius: 8px;
      background-color: #f8f8f8;
    }
    .metrics-list {
      list-style: none;
      padding: 0;
    }
    .metrics-list li {
      padding: 0.5rem 0;
      border-bottom: 1px dashed #eaeaea;
    }
    .bundle-info {
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid #eaeaea;
    }
    pre {
      background-color: #eaeaea;
      padding: 0.5rem;
      overflow-x: auto;
      border-radius: 4px;
    }
    button {
      background-color: #0070f3;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      cursor: pointer;
      margin-bottom: 1rem;
    }
    button:hover {
      background-color: #0060df;
    }
    .bundle-size {
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid #eaeaea;
    }
    .lazy-demo {
      margin-top: 1rem;
    }
    .hint {
      font-size: 0.8rem;
      color: #666;
      font-style: italic;
    }
    .resumability-demo {
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid #eaeaea;
    }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }
    .reload-button {
      background-color: #0070f3;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .reload-button:hover {
      background-color: #0060df;
    }
    .wallet-section {
      margin-top: 2rem;
      padding: 1rem;
      border: 1px solid #eaeaea;
      border-radius: 8px;
      background-color: #f8f8f8;
    }
  `);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    // Restore UI state from localStorage
    const savedShowDemo = localStorage.getItem('show-demo');
    if (savedShowDemo) {
      showDemo.value = savedShowDemo === 'true';
    }
    
    const savedShowMetrics = localStorage.getItem('show-metrics');
    if (savedShowMetrics) {
      showMetrics.value = savedShowMetrics === 'true';
    }
    
    // Helper function for robust scroll restoration
    const restoreScrollPosition = () => {
      const savedScrollY = localStorage.getItem('scroll-position');
      if (savedScrollY) {
        window.scrollTo(0, parseInt(savedScrollY, 10));
      }
    };
    
    // Wait for DOM and then images to load before restoring scroll
    window.addEventListener('DOMContentLoaded', restoreScrollPosition);
    window.addEventListener('load', restoreScrollPosition);
    
    // Also try after a short delay as a fallback
    setTimeout(restoreScrollPosition, 300);
    
    // Use a more reliable approach to save scroll position
    // Save scroll position not just on beforeunload but also during scrolling
    let scrollDebounceTimer: any;
    const saveScrollPosition = () => {
      clearTimeout(scrollDebounceTimer);
      scrollDebounceTimer = setTimeout(() => {
        localStorage.setItem('scroll-position', window.scrollY.toString());
      }, 100);
    };
    
    window.addEventListener('scroll', saveScrollPosition, { passive: true });
    window.addEventListener('beforeunload', () => {
      localStorage.setItem('scroll-position', window.scrollY.toString());
    });
    
    // Cleanup event listeners when component unmounts
    cleanup(() => {
      window.removeEventListener('scroll', saveScrollPosition);
      window.removeEventListener('beforeunload', () => {});
      window.removeEventListener('DOMContentLoaded', restoreScrollPosition);
      window.removeEventListener('load', restoreScrollPosition);
    });
    
    // This runs on the client after the component is mounted
    // Add the Farcaster Frame SDK from CDN
    const sdkScript = document.createElement('script');
    sdkScript.src = 'https://cdn.jsdelivr.net/npm/@farcaster/frame-sdk/dist/index.min.js';
    sdkScript.async = true;
    
    sdkScript.onload = () => {
      // Once the SDK is loaded, call the ready function
      // @ts-ignore - frame is globally available from the CDN script
      window.frame.sdk.actions.ready();
      console.log("Farcaster Frame SDK ready called from CDN");
    };
    
    document.head.appendChild(sdkScript);

    // Get basic page load time
    const pageLoadTime = performance.now();
    metrics.value = { ...metrics.value, pageLoadTime };

    // Get First Contentful Paint
    if ('performance' in window) {
      const perfEntries = performance.getEntriesByType('paint');
      const fcpEntry = perfEntries.find(entry => entry.name === 'first-contentful-paint');
      if (fcpEntry) {
        metrics.value = { ...metrics.value, fcp: fcpEntry.startTime };
      }
    }

    // Get Time to First Byte (TTFB)
    const navigationEntries = performance.getEntriesByType('navigation');
    if (navigationEntries.length > 0) {
      const navEntry = navigationEntries[0] as PerformanceNavigationTiming;
      metrics.value = { 
        ...metrics.value, 
        ttfb: navEntry.responseStart 
      };
    }

    // For more accurate Web Vitals, we would use the web-vitals library
    // But for simplicity, we're using the basic Performance API

    // Wait to show metrics until values are populated
    setTimeout(() => {
      // Get Largest Contentful Paint (using PerformanceObserver instead of deprecated API)
      const lcpValue = sessionStorage.getItem('lcp-value');
      if (lcpValue) {
        metrics.value = { ...metrics.value, lcp: parseFloat(lcpValue) };
      } else {
        // Set a reasonable fallback
        metrics.value = { ...metrics.value, lcp: pageLoadTime * 1.2 };
      }
      
      // Don't force metrics to be hidden, respect localStorage
      // showMetrics.value = false; // Start with metrics hidden
    }, 300);
    
    // Use PerformanceObserver to track LCP (modern approach)
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const lastEntry = entries[entries.length - 1];
          if (lastEntry) {
            const lcpTime = lastEntry.startTime;
            metrics.value = { ...metrics.value, lcp: lcpTime };
            sessionStorage.setItem('lcp-value', lcpTime.toString());
          }
        });
        
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      } catch (e) {
        console.error('LCP observer error:', e);
      }
    }
  });

  return (
    <div>
      <div class="page-header">
        <h1>Borg Boost</h1>
        <button class="reload-button" onClick$={() => window.location.reload()}>
          Reload
        </button>
      </div>

      <WalletConnect />

      <div class="demo-container">
        <h3>⚡ Resumability & Lazy Loading</h3>
        <button onClick$={() => {
          showDemo.value = !showDemo.value;
          localStorage.setItem('show-demo', showDemo.value.toString());
        }}>
          {showDemo.value ? 'Hide Demo' : 'Show Demo'}
        </button>

        {showDemo.value && (
          <>
            <div class="resumability-demo">
              <h4>Resumability</h4>
              <p>
                Qwik serializes the app state and event listeners, allowing it to "resume" 
                where the server left off without needing to re-execute initialization code.
              </p>
              <p>
                Try refreshing this page - notice how quickly it loads without 
                executing JavaScript to rebuild the UI state!
              </p>
            </div>
            
            <LazyDemo />
          </>
        )}
      </div>

      <div class="metrics-container">
        <h3>📊 Performance</h3>
        <button onClick$={() => {
          showMetrics.value = !showMetrics.value;
          localStorage.setItem('show-metrics', showMetrics.value.toString());
        }}>
          {showMetrics.value ? 'Hide Metrics' : 'Show Metrics'}
        </button>
        
        {showMetrics.value && (
          <>
            <ul class="metrics-list">
              <li>Page Load Time: {Math.round(metrics.value.pageLoadTime || 0)}ms</li>
              <li>First Contentful Paint: {Math.round(metrics.value.fcp || 0)}ms</li>
              <li>Time to First Byte: {Math.round(metrics.value.ttfb || 0)}ms</li>
              {metrics.value.lcp && <li>Largest Contentful Paint: {Math.round(metrics.value.lcp)}ms</li>}
              {metrics.value.cls && <li>Cumulative Layout Shift: {metrics.value.cls.toFixed(3)}</li>}
              {metrics.value.fid && <li>First Input Delay: {Math.round(metrics.value.fid)}ms</li>}
            </ul>
            
            <div class="bundle-size">
              <h4>Bundle Size Analysis</h4>
              <p>To view your bundle size information:</p>
              <ol>
                <li>Run <code>npm run build</code> in your terminal</li>
                <li>Review the output for bundle size information</li>
                <li>For detailed analysis, use <code>npm run build.analyze</code> (if configured in your package.json)</li>
              </ol>
              <p>For more detailed analysis, you can install <code>@builder.io/qwik-labs</code> and use:</p>
              <pre>
{`import { bundleStats$ } from '@builder.io/qwik-labs';

// Add to your component:
const stats = bundleStats$();

// Then display stats.value in your component`}
              </pre>
            </div>
            
            <div class="bundle-info">
              <h4>Symbol Usage</h4>
              <p>To collect symbol usage, add this code to your debug build:</p>
              <pre>
{`<script>
  window.symbols = [];
  document.addEventListener('qsymbol', (e) => window.symbols.push(e.detail));
</script>`}
              </pre>
              <p>Then run <code>console.log(window.symbols)</code> in the browser console.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Borg Boost",
  meta: [
    {
      name: "description",
      content: "Qwik site description",
    },
    {
      property: "og:title",
      content: "Borg Boost",
    },
    {
      property: "og:description",
      content: "A simple Farcaster Frame app built with Qwik",
    },
    {
      property: "og:image",
      content: `${appUrl}/icon.png`,
    },
    {
      property: "fc:frame",
      content: JSON.stringify(frame),
    },
  ],
};