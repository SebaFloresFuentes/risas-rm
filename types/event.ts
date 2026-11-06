export type Event = {
    id: string;
    slug: string;
    comedian: string;
    show: string;
    date: string;
    time: string;
  
    venue: string;
    comuna: string;
  
    priceFrom: number | null;
  
    ticketProvider: string | null;
    ticketUrl: string | null;
  
    imageUrl: string | null;
  
    featured: boolean;
    soldOut: boolean;
  
    verified: boolean;
  };