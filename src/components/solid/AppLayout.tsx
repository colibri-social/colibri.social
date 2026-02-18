import { useParams, A } from "@solidjs/router";
import { createSignal, type ParentComponent } from "solid-js";

const AppLayout: ParentComponent = (props) => {
  const params = useParams();
  // State inside the Sidebar is preserved during navigation
	const [count, setCount] = createSignal(0);

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <aside style={{ width: "200px", "border-right": "1px solid #ccc", padding: "1rem" }}>
        <h3>Community: {params.communityId}</h3>
        <p>Sidebar State (Counter): {count()}</p>
        <button onClick={() => setCount(c => c + 1)}>+</button>

        <nav style={{ "margin-top": "20px" }}>
          <A href={`/c/test`} style={{ display: "block" }}>Community</A>
          <A href={`/c/test/random`} style={{ display: "block" }}># random</A>
        </nav>
      </aside>

      <main style={{ flex: 1, padding: "1rem" }}>
        {/* Child routes (CommunityView or ChannelView) render here */}
        {props.children}
      </main>
    </div>
  );
};

export default AppLayout;
