import { useParams } from "@solidjs/router";

const ChannelView = () => {
  const params = useParams();

  return (
    <div>
      <h2>Channel: {params.channel}</h2>
      <p>This is the message list for the {params.channel} channel.</p>
    </div>
  );
};

export default ChannelView;
