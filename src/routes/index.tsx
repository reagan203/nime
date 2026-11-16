import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Header } from "~/components/Header";
import { Band, Hero, Levels, Mfi, Planned, Programme, Training } from "~/components/Sections";
import { Services } from "~/components/Services";
import { Contact, Footer, Sources } from "~/components/Contact";
import { NineChat } from "~/components/NineChat";
import { bootNine } from "~/nine/boot";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  // Nine is imperative (animation frames, speech, a 360 turn on a canvas), so she starts once the page is in the browser
  useEffect(() => { bootNine(); }, []);
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Band />
        <Levels />
        <Training />
        <Services />
        <Programme />
        <Mfi />
        <Planned />
        <Contact />
      </main>
      <Footer />
      <Sources />
      <NineChat />
    </>
  );
}
