import { useState } from "react";
import { Sparkles, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ChannelSelector } from "@/components/ChannelSelector";
import { GeneratedBlock } from "@/components/GeneratedBlock";
import { useChannels } from "@/hooks/useChannels";
import { useCreateDubLink } from "@/hooks/useDubApi";
import { useCreateGeneratedLink } from "@/hooks/useGeneratedLinks";

interface GeneratedBlockData {
  channelId: string;
  channelName: string;
  channelColor: string;
  adCopy: string;
  shortLink: string;
}

export default function Generator() {
  const [adCopy, setAdCopy] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("https://example.com");
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [generatedBlocks, setGeneratedBlocks] = useState<GeneratedBlockData[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: channels, isLoading: channelsLoading } = useChannels();
  const createDubLink = useCreateDubLink();
  const createGeneratedLink = useCreateGeneratedLink();

  const handleGenerate = async () => {
    if (!adCopy.trim()) {
      toast.error("Please enter ad copy");
      return;
    }
    if (selectedChannels.length === 0) {
      toast.error("Please select at least one channel");
      return;
    }
    if (!destinationUrl.trim()) {
      toast.error("Please enter a destination URL");
      return;
    }

    setIsGenerating(true);
    setGeneratedBlocks([]);

    const newBlocks: GeneratedBlockData[] = [];

    for (const channelId of selectedChannels) {
      const channel = channels?.find((c) => c.id === channelId);
      if (!channel) continue;

      try {
        // Build URL with UTM parameters
        const url = new URL(destinationUrl);
        url.searchParams.set("utm_source", channel.name.toLowerCase().replace(/\s+/g, "_"));
        url.searchParams.set("utm_medium", "social");
        url.searchParams.set("utm_campaign", "general");

        // Create short link via Dub.co
        const dubLink = await createDubLink.mutateAsync({
          url: url.toString(),
          tags: [channel.name],
        });

        // Save to database
        await createGeneratedLink.mutateAsync({
          channel_id: channelId,
          short_link: dubLink.shortLink,
          destination_url: url.toString(),
          ad_copy: adCopy,
          dub_link_id: dubLink.id,
        });

        newBlocks.push({
          channelId,
          channelName: channel.name,
          channelColor: channel.color,
          adCopy,
          shortLink: dubLink.shortLink,
        });

        // Update UI progressively
        setGeneratedBlocks([...newBlocks]);
      } catch (error) {
        console.error(`Error creating link for ${channel.name}:`, error);
        toast.error(`Failed to create link for ${channel.name}`);
      }
    }

    setIsGenerating(false);
    if (newBlocks.length > 0) {
      toast.success(`Generated ${newBlocks.length} tracking links!`);
    }
  };

  const handleCopyAll = async () => {
    const allText = generatedBlocks
      .map((block) => `--- ${block.channelName} ---\n${block.adCopy}\n\n${block.shortLink}`)
      .join("\n\n\n");

    try {
      await navigator.clipboard.writeText(allText);
      toast.success("All blocks copied to clipboard!");
    } catch (err) {
      toast.error("Failed to copy");
    }
  };

  return (
    <div className="min-h-screen lg:pl-0 pt-16 lg:pt-0">
      <div className="max-w-4xl mx-auto p-4 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">
            Content Generator
          </h1>
          <p className="text-muted-foreground">
            Create tracked marketing links for your campaigns
          </p>
        </div>

        {/* Input Form */}
        <div className="bg-card rounded-2xl border border-border p-4 lg:p-6 shadow-sm mb-8">
          <div className="space-y-6">
            {/* Destination URL */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Destination URL
              </label>
              <input
                type="url"
                value={destinationUrl}
                onChange={(e) => setDestinationUrl(e.target.value)}
                placeholder="https://your-landing-page.com"
                className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              />
            </div>

            {/* Ad Copy */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Ad Copy
              </label>
              <textarea
                value={adCopy}
                onChange={(e) => setAdCopy(e.target.value)}
                placeholder="Enter your promotional text here..."
                rows={5}
                className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {adCopy.length} characters
              </p>
            </div>

            {/* Channel Selector */}
            <ChannelSelector
              channels={channels || []}
              selectedChannels={selectedChannels}
              onSelectionChange={setSelectedChannels}
              isLoading={channelsLoading}
            />

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !adCopy.trim() || selectedChannels.length === 0}
              className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-primary/20"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  Generate Blocks
                </>
              )}
            </button>
          </div>
        </div>

        {/* Generated Blocks */}
        {generatedBlocks.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                Ready-to-Post Blocks
              </h2>
              <button
                onClick={handleCopyAll}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors text-sm font-medium"
              >
                <Copy className="h-4 w-4" />
                Copy All
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {generatedBlocks.map((block, index) => (
                <GeneratedBlock
                  key={block.channelId}
                  channelName={block.channelName}
                  channelColor={block.channelColor}
                  adCopy={block.adCopy}
                  shortLink={block.shortLink}
                  index={index}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
