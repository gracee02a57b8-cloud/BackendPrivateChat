import { useEffect, useState } from "react";

const DEFAULT_OPTIONS = {};

function useIntersectionObserver(element, options = DEFAULT_OPTIONS) {
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) =>
      setIsIntersecting(entry.isIntersecting),
    );

    observer.observe(element, options);

    return () => observer.disconnect();
  }, [element, options]);

  return isIntersecting;
}

export default useIntersectionObserver;
